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
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    expect(doc.status).toBe("draft");

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");
    expect(submitRes.json().approvals).toHaveLength(1);
    expect(submitRes.json().approvals[0].status).toBe("pending");

    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
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
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const rejectRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "rejected", comment: "Needs revision" },
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
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });

    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerToken,
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
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerToken,
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
    const ownerToken = generateToken(user);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
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
      payload: { approverId: user.id, decision: "approved" },
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

  it("re-submit tras reject funciona con el mismo approver", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "rejected" },
    });

    const resubmitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    expect(resubmitRes.statusCode).toBe(200);
    expect(resubmitRes.json().status).toBe("in_review");
    expect(resubmitRes.json().approvals).toHaveLength(1);
    expect(resubmitRes.json().approvals[0].status).toBe("pending");

    await app.close();
  });

  it("IDs de aprobador duplicados en el array no rompen (se deduplican)", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const doc = await createDoc(app, ownerToken, user.id);

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id, approver.id] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().approvals).toHaveLength(1);

    await app.close();
  });

  it("crear → submit → approve → obsolete (e2e completo)", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    expect(doc.status).toBe("draft");

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");

    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");

    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerToken,
      payload: { actorId: user.id, reason: "Documento reemplazado" },
    });
    expect(obsoleteRes.statusCode).toBe(200);
    expect(obsoleteRes.json().status).toBe("obsolete");
    expect(obsoleteRes.json().obsoleteReason).toBe("Documento reemplazado");

    await app.close();
  });

  it("crear → submit → reject → re-submit → approve → obsolete (e2e recuperación)", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    expect(doc.status).toBe("draft");

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");

    const rejectRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "rejected", comment: "Needs changes" },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().status).toBe("draft");
    expect(rejectRes.json().approvals[0].status).toBe("rejected");

    const resubmitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(resubmitRes.statusCode).toBe(200);
    expect(resubmitRes.json().status).toBe("in_review");

    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");

    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerToken,
      payload: { actorId: user.id, reason: "Ciclo completado" },
    });
    expect(obsoleteRes.statusCode).toBe(200);
    expect(obsoleteRes.json().status).toBe("obsolete");

    await app.close();
  });

  it("approvalProgress: draft → { approvedSteps: 0, totalSteps: 0 }", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    expect(doc.approvalProgress).toEqual({ approvedSteps: 0, totalSteps: 0 });

    const listRes = await inject(app, "GET", "/api/v1/documents", { token });
    expect(listRes.statusCode).toBe(200);
    const listItem = listRes.json().items.find((d: Record<string, unknown>) => d.id === doc.id);
    expect(listItem.approvalProgress).toEqual({ approvedSteps: 0, totalSteps: 0 });

    await app.close();
  });

  it("approvalProgress: in_review → { approvedSteps: 0, totalSteps: 1 }", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const doc = await createDoc(app, ownerToken, user.id);

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().approvalProgress).toEqual({ approvedSteps: 0, totalSteps: 1 });

    await app.close();
  });

  it("approvalProgress: approved → { approvedSteps: 1, totalSteps: 1 }", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().approvalProgress).toEqual({ approvedSteps: 1, totalSteps: 1 });

    await app.close();
  });

  it("approvalProgress: obsolete → { approvedSteps: 1, totalSteps: 1 }", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });
    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerToken,
      payload: { actorId: user.id, reason: "Replaced" },
    });
    expect(obsoleteRes.statusCode).toBe(200);
    expect(obsoleteRes.json().approvalProgress).toEqual({ approvedSteps: 1, totalSteps: 1 });

    await app.close();
  });

  it("approvalProgress: múltiples aprobadores, progreso parcial", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver1 } = await createTestUser(prisma);
    const { user: approver2 } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const approver1Token = generateToken(approver1);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver1.id, approver2.id] },
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approver1Token,
      payload: { approverId: approver1.id, decision: "approved" },
    });

    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: ownerToken });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().approvalProgress).toEqual({ approvedSteps: 1, totalSteps: 2 });

    await app.close();
  });

  it("usuario no aprobador recibe 403 al intentar aprobar", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const { user: otherUser } = await createTestUser(prisma);
    const ownerToken = generateToken(user);
    const otherToken = generateToken(otherUser);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: otherToken,
      payload: { approverId: approver.id, decision: "approved" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain("No autorizado");

    await app.close();
  });

  it("admin puede aprobar en nombre de cualquier aprobador", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const ownerToken = generateToken(user);
    const adminToken = generateToken(admin);
    const doc = await createDoc(app, ownerToken, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: adminToken,
      payload: { approverId: approver.id, decision: "approved" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("approved");

    await app.close();
  });
});
