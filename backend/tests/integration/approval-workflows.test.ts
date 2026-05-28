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
  const headers: Record<string, string> = {};
  if (opts?.payload !== undefined) headers["content-type"] = "application/json";
  if (opts?.token) headers["authorization"] = `Bearer ${opts.token}`;

  return app.inject({
    method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    url,
    headers,
    payload: opts?.payload,
  });
}

async function createDoc(app: ReturnType<typeof buildApp>, token: string, ownerId: string, category: string) {
  const res = await inject(app, "POST", "/api/v1/documents", {
    token,
    payload: {
      code: `WF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Workflow Test",
      description: "desc",
      category,
      standardTags: [],
      ownerId,
      content: "content",
      createdBy: ownerId,
    },
  });

  return res.json();
}

describe("Approval Workflows API", () => {
  it("admin puede configurar flujo por categoría y submit usa aprobadores configurados", async () => {
    const app = buildApp();
    await app.ready();

    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const { user: owner } = await createTestUser(prisma, { role: "owner" });
    const { user: qaApprover } = await createTestUser(prisma, { role: "approver", name: "QA Approver" });
    const { user: rdApprover } = await createTestUser(prisma, { role: "approver", name: "R&D Approver" });

    const adminToken = generateToken(admin);
    const ownerToken = generateToken(owner);
    const qaToken = generateToken(qaApprover);
    const rdToken = generateToken(rdApprover);

    const setRes = await inject(app, "PUT", "/api/v1/approval-workflows/quality", {
      token: adminToken,
      payload: {
        steps: [
          { approverId: qaApprover.id, responsibility: "QA Review" },
          { approverId: rdApprover.id, responsibility: "R&D Validation" },
        ],
      },
    });

    expect(setRes.statusCode).toBe(200);
    expect(setRes.json().category).toBe("quality");
    expect(setRes.json().steps).toHaveLength(2);

    const doc = await createDoc(app, ownerToken, owner.id, "quality");

    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerToken,
      payload: { actorId: owner.id },
    });

    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");
    expect(submitRes.json().approvals).toHaveLength(2);

    const approvalIds = submitRes
      .json()
      .approvals.map((approval: { approverId: string }) => approval.approverId)
      .sort();

    expect(approvalIds).toEqual([qaApprover.id, rdApprover.id].sort());

    const outOfOrderRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: rdToken,
      payload: { approverId: rdApprover.id, decision: "approved" },
    });

    expect(outOfOrderRes.statusCode).toBe(422);
    expect(outOfOrderRes.json().message).toContain("fuera de orden");

    const firstStepRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: qaToken,
      payload: { approverId: qaApprover.id, decision: "approved" },
    });

    expect(firstStepRes.statusCode).toBe(200);
    expect(firstStepRes.json().status).toBe("in_review");

    const secondStepRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: rdToken,
      payload: { approverId: rdApprover.id, decision: "approved" },
    });

    expect(secondStepRes.statusCode).toBe(200);
    expect(secondStepRes.json().status).toBe("approved");

    await app.close();
  });

  it("usuario no admin no puede configurar flujos", async () => {
    const app = buildApp();
    await app.ready();

    const { user: owner } = await createTestUser(prisma, { role: "owner" });
    const { user: approver } = await createTestUser(prisma, { role: "approver" });
    const token = generateToken(owner);

    const res = await inject(app, "PUT", "/api/v1/approval-workflows/quality", {
      token,
      payload: {
        steps: [{ approverId: approver.id, responsibility: "QA Review" }],
      },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it("submit sin approverIds ni flujo configurado devuelve 422", async () => {
    const app = buildApp();
    await app.ready();

    const { user: owner } = await createTestUser(prisma, { role: "owner" });
    const token = generateToken(owner);
    const doc = await createDoc(app, token, owner.id, "regulatory");

    const res = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token,
      payload: { actorId: owner.id },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().message).toContain("No hay flujo de aprobación configurado");

    await app.close();
  });
});
