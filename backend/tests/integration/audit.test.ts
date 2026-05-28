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
      code: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Audit Test",
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

describe("Audit Trail", () => {
  it("crear documento genera AuditEvent con action document.created", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token });

    expect(auditRes.statusCode).toBe(200);
    const items = auditRes.json().items;
    expect(items).toBeInstanceOf(Array);
    expect(items.length).toBeGreaterThanOrEqual(1);

    const createdEvent = items.find((e: { action: string }) => e.action === "document.created");
    expect(createdEvent).toBeDefined();
    expect(createdEvent.entityId).toBe(doc.id);
    expect(createdEvent.details.code).toBe(doc.code);

    await app.close();
  });

  it("submit genera AuditEvent con from/to en details", async () => {
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

    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token });

    const submitEvent = auditRes.json().items.find(
      (e: { action: string }) => e.action === "document.submitted"
    );
    expect(submitEvent).toBeDefined();
    expect(submitEvent.details.from).toBe("draft");
    expect(submitEvent.details.to).toBe("in_review");
    expect(submitEvent.details.approvers).toBeInstanceOf(Array);

    await app.close();
  });

  it("approve genera AuditEvent con from/to correctos", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "approved" },
    });

    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token });

    const approveEvent = auditRes.json().items.find(
      (e: { action: string }) => e.action === "document.approved"
    );
    expect(approveEvent).toBeDefined();
    expect(approveEvent.details.from).toBe("in_review");
    expect(approveEvent.details.to).toBe("approved");

    await app.close();
  });

  it("reject genera AuditEvent con document.rejected", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const { user: approver } = await createTestUser(prisma);
    const token = generateToken(user);
    const approverToken = generateToken(approver);
    const doc = await createDoc(app, token, user.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: user.id, approverIds: [approver.id] },
    });
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverToken,
      payload: { approverId: approver.id, decision: "rejected" },
    });

    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token });

    const rejectEvent = auditRes.json().items.find(
      (e: { action: string }) => e.action === "document.rejected"
    );
    expect(rejectEvent).toBeDefined();
    expect(rejectEvent.details.from).toBe("in_review");
    expect(rejectEvent.details.to).toBe("draft");

    await app.close();
  });

  it("solo se crean AuditEvent, nunca se hace update/delete desde la app", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);
    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token });

    const events = auditRes.json().items;
    expect(events.length).toBeGreaterThanOrEqual(1);

    for (const event of events) {
      expect(event.action).toBeDefined();
      expect(event.entityId).toBe(doc.id);
      expect(event.entityType).toBe("document");
      expect(event.timestamp).toBeDefined();
    }

    await app.close();
  });
});
