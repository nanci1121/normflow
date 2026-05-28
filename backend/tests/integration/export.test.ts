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
      code: `EXPORT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "Export Test",
      description: "desc",
      category: "quality",
      standardTags: ["iso9001"],
      ownerId,
      content: "content",
      createdBy: ownerId,
    },
  });
  return res.json();
}

describe("Exportación de auditoría", () => {
  it("GET /audit/export?format=csv devuelve CSV con cabeceras", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=csv`, {
      token,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain(".csv");
    const body = res.body;
    expect(body).toContain("ID,Timestamp,ActorId,Action,EntityType,EntityId,Details");
    expect(body).toContain("document.created");

    await app.close();
  });

  it("GET /audit/export?format=pdf devuelve PDF", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=pdf`, {
      token,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain(".pdf");
    expect(res.body.length).toBeGreaterThan(100);

    // PDF magic number
    expect(res.body.substring(0, 4)).toBe("%PDF");

    await app.close();
  });

  it("GET /audit/export sin formato devuelve 400", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const doc = await createDoc(app, token, user.id);

    const res = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export`, {
      token,
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it("GET /audit/export?format=pdf incluye info del documento y eventos", async () => {
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

    const res = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=pdf`, {
      token,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.substring(0, 4)).toBe("%PDF");
    expect(res.body.length).toBeGreaterThan(500);

    await app.close();
  });

  it("documento inexistente devuelve 404", async () => {
    const app = buildApp();
    await app.ready();

    const res = await inject(app, "GET", "/api/v1/documents/nonexistent-id/audit/export?format=csv");

    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
