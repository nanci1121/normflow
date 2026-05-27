import cors from "@fastify/cors";
import Fastify from "fastify";
import { AuthService, HttpError } from "./auth";
import { createUserSchema, authLoginSchema } from "./schemas";
import { DocumentStore } from "./store";
import { CreateUserInput, LoginInput } from "./types";

export function buildApp() {
  const app = Fastify({ logger: true });
  const store = new DocumentStore();
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

  void app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "qms-platform-server",
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/v1/overview", async () => {
    const documents = await store.listDocuments();
    return {
      documentsTotal: documents.length,
      byStatus: documents.reduce<Record<string, number>>((accumulator, document) => {
        accumulator[document.status] = (accumulator[document.status] ?? 0) + 1;
        return accumulator;
      }, {}),
      recentAuditEvents: (await store.getAuditEvents()).slice(0, 10),
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

  app.get("/api/v1/documents", async (request) => {
    const search = (request.query as { search?: string }).search;
    return {
      items: await store.listDocuments(search),
    };
  });

  app.get("/api/v1/documents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const document = await store.getDocument(id);

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

    const created = await store.createDocument(body);
    return reply.code(201).send(created);
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
      approverIds: string[];
    };

    try {
      return await store.submitForApproval(id, body);
    } catch (error) {
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.post("/api/v1/documents/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      actorId: string;
      approverId: string;
      comment?: string;
    };

    try {
      return await store.resolveApproval(id, body);
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
      const handled = handleError(error, 404);
      return reply.code(handled.statusCode).send({ message: handled.message });
    }
  });

  app.get("/api/v1/documents/:id/audit", async (request, reply) => {
    const { id } = request.params as { id: string };
    const document = await store.getDocument(id);

    if (!document) {
      return reply.code(404).send({ message: "Documento no encontrado" });
    }

    return {
      items: await store.getAuditEvents(id),
    };
  });

  return app;
}
