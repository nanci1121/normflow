import cors from "@fastify/cors";
import Fastify from "fastify";
import { AuthService } from "./auth";
import { createUserSchema, authLoginSchema, resetPasswordSchema, changePasswordSchema, setApprovalWorkflowSchema } from "./schemas";
import { DocumentStore } from "./store";
import { ApprovalWorkflowStepInput, ChangePasswordInput, CreateUserInput, HttpError, LoginInput, ResetPasswordInput, UserContext } from "./types";
import { createEmailService } from "./email";
import { exportAudit, ExportFormat } from "./export";
import { prisma } from "./db";

export function buildApp(emailService?: ReturnType<typeof createEmailService>) {
  const app = Fastify({ logger: true });
  const store = new DocumentStore(emailService ?? undefined);
  const auth = new AuthService();

  function handleError(error: unknown, fallbackStatusCode = 400) {
    if (error instanceof HttpError) {
      return { statusCode: error.statusCode, message: error.message };
    }
    if (error instanceof Error) {
      return { statusCode: fallbackStatusCode, message: error.message };
    }
    return { statusCode: fallbackStatusCode, message: "Error inesperado" };
  }

  function requireAuth(authorizationHeader?: string) {
    return auth.verifyToken(authorizationHeader);
  }

  function getUserContext(authorizationHeader?: string): UserContext | undefined {
    try {
      const payload = requireAuth(authorizationHeader);
      return { id: payload.sub, role: payload.role };
    } catch {
      return undefined;
    }
  }

  void app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "qms-platform-server",
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/v1/overview", async (request) => {
    const user = getUserContext(request.headers.authorization);
    const { items: documents } = await store.listDocuments(undefined, user);

    const pendingApprovals = user
      ? await store.getPendingApprovals(user.id)
      : [];

    return {
      documentsTotal: documents.length,
      byStatus: documents.reduce<Record<string, number>>((accumulator, document) => {
        accumulator[document.status] = (accumulator[document.status] ?? 0) + 1;
        return accumulator;
      }, {}),
      recentAuditEvents: (await store.getAuditEvents()).slice(0, 10),
      pendingApprovals,
    };
  });

  app.post("/api/v1/auth/login", { schema: authLoginSchema }, async (request, reply) => {
    const body = request.body as LoginInput;

    try {
      return await auth.login(body);
    } catch (error) {
      const handled = handleError(error, 401);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    try {
      const tokenPayload = requireAuth(request.headers.authorization);
      return await auth.getMe(tokenPayload.sub);
    } catch (error) {
      const handled = handleError(error, 401);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/auth/logout", async (_request, reply) => {
    return reply.code(200).send({ message: "Sesión cerrada" });
  });

  app.post("/api/v1/users", { schema: createUserSchema }, async (request, reply) => {
    const body = request.body as CreateUserInput;

    try {
      const tokenPayload = requireAuth(request.headers.authorization);
      const created = await auth.createUser(tokenPayload.role, body);
      return reply.code(201).send(created);
    } catch (error) {
      const handled = handleError(error, 400);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.get("/api/v1/users", async (request, reply) => {
    try {
      const tokenPayload = requireAuth(request.headers.authorization);
      if (tokenPayload.role !== "admin") {
        return reply.code(403).send({ message: "No autorizado" });
      }
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, isActive: true, mustChangePassword: true },
        orderBy: { createdAt: "desc" },
      });
      return { items: users };
    } catch (error) {
      const handled = handleError(error, 403);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.patch("/api/v1/users/:id/toggle-active", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const tokenPayload = requireAuth(request.headers.authorization);
      const updated = await auth.toggleUserActive(tokenPayload.role, id);
      return reply.send(updated);
    } catch (error) {
      const handled = handleError(error, 403);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.patch(
    "/api/v1/users/:id/reset-password",
    { schema: resetPasswordSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as ResetPasswordInput;

      try {
        const tokenPayload = requireAuth(request.headers.authorization);
        const result = await auth.resetPassword(tokenPayload.role, id, body);

        await prisma.auditEvent.create({
          data: {
            actorId: tokenPayload.sub,
            action: "user.password_reset",
            entityId: id,
            entityType: "document",
            details: { resetBy: tokenPayload.sub },
          },
        });

        return reply.send(result);
      } catch (error) {
        const handled = handleError(error, 403);
        return reply.code(handled.statusCode).send({ message: handled.message });
      }
    }
  );

  app.patch(
    "/api/v1/auth/change-password",
    { schema: changePasswordSchema },
    async (request, reply) => {
      const body = request.body as ChangePasswordInput;

      try {
        const tokenPayload = requireAuth(request.headers.authorization);
        const result = await auth.changePassword(tokenPayload.sub, body);
        return reply.send(result);
      } catch (error) {
        const handled = handleError(error, 400);
        return reply.code(handled.statusCode).send({ message: handled.message });
      }
    }
  );

  app.get("/api/v1/approval-workflows", async (request, reply) => {
    try {
      const tokenPayload = requireAuth(request.headers.authorization);
      if (tokenPayload.role !== "admin") {
        return reply.code(403).send({ message: "No autorizado" });
      }

      return { items: await store.listApprovalWorkflows() };
    } catch (error) {
      const handled = handleError(error, 403);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.put(
    "/api/v1/approval-workflows/:category",
    { schema: setApprovalWorkflowSchema },
    async (request, reply) => {
      const { category } = request.params as { category: string };
      const body = request.body as { steps: ApprovalWorkflowStepInput[] };

      try {
        const tokenPayload = requireAuth(request.headers.authorization);
        if (tokenPayload.role !== "admin") {
          return reply.code(403).send({ message: "No autorizado" });
        }

        const workflow = await store.setApprovalWorkflow(category, body.steps, tokenPayload.sub);
        return reply.code(200).send(workflow);
      } catch (error) {
        const handled = handleError(error, 422);
        return reply.code(handled.statusCode).send({ message: handled.message });
      }
    }
  );

  app.get("/api/v1/documents", async (request) => {
    const query = request.query as {
      search?: string;
      status?: "draft" | "in_review" | "approved" | "obsolete";
      category?: string;
      visibility?: "internal" | "restricted";
      owner?: string;
      sortBy?: "title" | "status" | "updatedAt";
      sortOrder?: "asc" | "desc";
      page?: string | number;
      pageSize?: string | number;
    };
    const user = getUserContext(request.headers.authorization);
    const page = typeof query.page === "string" ? Number(query.page) : query.page;
    const pageSize = typeof query.pageSize === "string" ? Number(query.pageSize) : query.pageSize;
    return store.listDocuments(
      {
        search: query.search,
        status: query.status,
        category: query.category,
        visibility: query.visibility,
        owner: query.owner,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: Number.isFinite(page as number) ? (page as number) : undefined,
        pageSize: Number.isFinite(pageSize as number) ? (pageSize as number) : undefined,
      },
      user
    );
  });

  app.get("/api/v1/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUserContext(request.headers.authorization);
    const document = await store.getDocument(id, user);

    if (!document) {
      return reply.code(404).send({ message: "Documento no encontrado" });
    }

    return document;
  });

  app.post("/api/v1/documents", async (request, reply) => {
    const body = request.body as {
      code: string;
      title: string;
      description: string;
      category: string;
      standardTags: string[];
      ownerId: string;
      visibility?: "internal" | "restricted";
      content: string;
      createdBy: string;
    };

    try {
      const created = await store.createDocument(body);
      return reply.code(201).send(created);
    } catch (error) {
      const handled = handleError(error, 400);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/versions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      title: string;
      content: string;
      changeSummary: string;
      createdBy: string;
    };

    try {
      const updated = await store.addVersion(id, body);
      return reply.code(201).send(updated);
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/submit", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      actorId: string;
      approverIds?: string[];
    };

    try {
      return await store.submitForApproval(id, body);
    } catch (error) {
      const handled = handleError(error, 422);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tokenPayload = requireAuth(request.headers.authorization);
    const body = request.body as {
      approverId: string;
      decision: "approved" | "rejected";
      comment?: string;
    };

    try {
      return await store.resolveApproval(id, {
        actorId: tokenPayload.sub,
        actorRole: tokenPayload.role,
        ...body,
      });
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/sign", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      actorId: string;
      signatureValue: string;
    };

    try {
      return await store.signDocument(id, body);
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/obsolete", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      actorId: string;
      reason: string;
    };

    try {
      return await store.obsoleteDocument(id, body.actorId, body.reason);
    } catch (error) {
      const handled = handleError(error, 422);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.get("/api/v1/documents/:id/audit", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { from?: string; to?: string; actorId?: string; action?: string };
    const user = getUserContext(request.headers.authorization);
    const document = await store.getDocument(id, user);

    if (!document) {
      return reply.code(404).send({ message: "Documento no encontrado" });
    }

    return {
      items: await store.getAuditEvents(id, {
        from: query.from,
        to: query.to,
        actorId: query.actorId,
        action: query.action,
      }),
    };
  });

  app.get("/api/v1/documents/:id/audit/export", async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { format?: string; from?: string; to?: string; actorId?: string; action?: string };
    const user = getUserContext(request.headers.authorization);

    if (!query.format || !["csv", "pdf"].includes(query.format)) {
      return reply.code(400).send({ message: "Formato inválido. Use ?format=csv o ?format=pdf" });
    }

    try {
      const document = await store.getDocument(id, user);
      if (!document) {
        return reply.code(404).send({ message: "Documento no encontrado" });
      }

      const events = await store.getAuditEvents(id, {
        from: query.from,
        to: query.to,
        actorId: query.actorId,
        action: query.action,
      });
      const result = await exportAudit(query.format as ExportFormat, document, events, user?.id);

      reply.header("Content-Type", result.contentType);
      reply.header("Content-Disposition", `attachment; filename="${result.filename}"`);
      return reply.send(result.data);
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  // --- Document Access Control ---

  app.post("/api/v1/documents/:id/access", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { userId: string; actorId: string };
    const user = getUserContext(request.headers.authorization);

    if (!user || user.id !== body.actorId) {
      return reply.code(403).send({ message: "No autorizado" });
    }

    try {
      const result = await store.grantDocumentAccess(id, body.userId, body.actorId);
      return reply.code(201).send(result);
    } catch (error) {
      const handled = handleError(error, 409);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.delete("/api/v1/documents/:id/access/:userId", async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const user = getUserContext(request.headers.authorization);

    if (!user) {
      return reply.code(403).send({ message: "No autorizado" });
    }

    try {
      await store.revokeDocumentAccess(id, userId, user.id);
      return reply.code(200).send({ message: "Acceso revocado" });
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.get("/api/v1/documents/:id/access", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = getUserContext(request.headers.authorization);

    if (!user) {
      return reply.code(403).send({ message: "No autorizado" });
    }

    try {
      const grants = await store.listDocumentGrants(id, user.id);
      return { items: grants };
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  return app;
}
