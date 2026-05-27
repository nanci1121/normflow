import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app";
import { createTestUser, generateToken } from "../helpers/factory";
import { prisma } from "../../src/db";

async function inject(
  app: ReturnType<typeof buildApp>,
  method: string,
  url: string,
  opts?: { token?: string; payload?: unknown }
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.token) headers["authorization"] = `Bearer ${opts.token}`;
  return app.inject({
    method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url,
    headers,
    payload: opts?.payload,
  });
}

async function createDoc(app: ReturnType<typeof buildApp>, token: string, ownerId: string) {
  const res = await inject(app, "POST", "/api/v1/documents", {
    token,
    payload: {
      code: `LIFECYCLE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Lifecycle Test",
      description: "desc",
      category: "quality",
      standardTags: [],
      ownerId,
      content: "content",
      createdBy: ownerId,
    },
  });
  return res.json();
}

describe("Document Lifecycle", () => {
  it("crear documento → submit → approve (ciclo completo)", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    expect(doc.status).toBe("draft");

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");
    expect(submitRes.json().approvals).toHaveLength(1);
    expect(submitRes.json().approvals[0].status).toBe("pending");

    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token,
      payload: { actorId: user.id, approverId: approver.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");

    await app.close();
  });

  it("crear documento → submit → reject → vuelve a draft", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const rejectRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token,
      payload: { actorId: user.id, approverId: approver.id, decision: "rejected", comment: "Needs revision" },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().status).toBe("draft");

    const approval = rejectRes.json().approvals[0];
    expect(approval.status).toBe("rejected");
    expect(approval.comment).toBe("Needs revision");

    await app.close();
  });

  it("approve → obsolete con motivo → status obsolete", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token,
      payload: { actorId: user.id, approverId: approver.id, decision: "approved" },
    });

    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token,
      payload: { actorId: user.id, reason: "Documento reemplazado por nueva versión" },
    });

    expect(obsoleteRes.statusCode).toBe(200);
    expect(obsoleteRes.json().status).toBe("obsolete");
    expect(obsoleteRes.json().obsoleteReason).toBe("Documento reemplazado por nueva versión");

    await app.close();
  });

  it("obsolete sin motivo → 422", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token,
      payload: { actorId: user.id, approverId: approver.id, decision: "approved" },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token,
      payload: { actorId: user.id, reason: "" },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().message).toBeDefined();

    await app.close();
  });

  it("submit desde in_review → 422", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().message).toContain("No se puede enviar a revisión");

    await app.close();
  });

  it("approve sin estar in_review → 422", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token,
      payload: { actorId: user.id, approverId: user.id, decision: "approved" },
    });

    expect(res.statusCode).toBe(422);

    await app.close();
  });

  it("obsolete desde draft → 422", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token,
      payload: { actorId: user.id, reason: "Some reason" },
    });

    expect(res.statusCode).toBe(422);

    await app.close();
  });

  it("aprobador duplicado → 409", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id, approver.id] },
    });

    expect(res.statusCode).toBe(409);

    await app.close();
  });
});
