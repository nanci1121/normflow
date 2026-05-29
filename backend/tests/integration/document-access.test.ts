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

async function createRestrictedDoc(app: ReturnType<typeof buildApp>, token: string, ownerId: string) {
  const res = await inject(app, "POST", "/api/v1/documents", {
    token,
    payload: {
      code: `ACL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: "ACL Restricted Test",
      description: "desc",
      category: "quality",
      standardTags: [],
      ownerId,
      visibility: "restricted",
      content: "confidential content",
      createdBy: ownerId,
    },
  });
  return res.json();
}

describe("Document Access Control (ACL)", () => {
  it("propietario concede acceso a otro usuario → usuario ve el documento restricted", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const granteeToken = generateToken(grantee);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    // Grantee should NOT see it initially
    const listBefore = await inject(app, "GET", "/api/v1/documents", { token: granteeToken });
    expect(listBefore.statusCode).toBe(200);
    const foundBefore = listBefore.json().items.find((d: { code: string }) => d.code === doc.code);
    expect(foundBefore).toBeUndefined();

    // Grant access
    const grantRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });
    expect(grantRes.statusCode).toBe(201);
    expect(grantRes.json().userId).toBe(grantee.id);

    // Grantee should now see it in list
    const listAfter = await inject(app, "GET", "/api/v1/documents", { token: granteeToken });
    expect(listAfter.statusCode).toBe(200);
    const foundAfter = listAfter.json().items.find((d: { code: string }) => d.code === doc.code);
    expect(foundAfter).toBeDefined();
    expect(foundAfter.id).toBe(doc.id);

    // Grantee should be able to get detail
    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: granteeToken });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().id).toBe(doc.id);

    await app.close();
  });

  it("revocar acceso → usuario deja de ver el documento restricted", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const granteeToken = generateToken(grantee);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    // Grant
    await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });

    // Revoke
    const revokeRes = await inject(app, "DELETE", `/api/v1/documents/${doc.id}/access/${grantee.id}`, {
      token: ownerToken,
    });
    expect(revokeRes.statusCode).toBe(200);

    // Grantee should no longer see it
    const listRes = await inject(app, "GET", "/api/v1/documents", { token: granteeToken });
    const found = listRes.json().items.find((d: { code: string }) => d.code === doc.code);
    expect(found).toBeUndefined();

    await app.close();
  });

  it("listar accesos concedidos devuelve usuarios con nombre y email", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });

    const listRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items).toHaveLength(1);
    expect(listRes.json().items[0].userId).toBe(grantee.id);
    expect(listRes.json().items[0].userName).toBe(grantee.name);
    expect(listRes.json().items[0].userEmail).toBe(grantee.email);

    await app.close();
  });

  it("usuario no propietario recibe 403 al conceder acceso", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: intruder } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const intruderToken = generateToken(intruder);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    const grantRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: intruderToken,
      payload: { userId: grantee.id, actorId: intruder.id },
    });
    expect(grantRes.statusCode).toBe(403);

    await app.close();
  });

  it("conceder acceso a documento no restricted devuelve 422", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);

    const res = await inject(app, "POST", "/api/v1/documents", {
      token: ownerToken,
      payload: {
        code: `INTERNAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "Internal Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: owner.id,
        visibility: "internal",
        content: "content",
        createdBy: owner.id,
      },
    });
    const doc = res.json();

    const grantRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });
    expect(grantRes.statusCode).toBe(422);

    await app.close();
  });

  it("conceder acceso duplicado devuelve 409", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: grantee } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });

    const dupRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/access`, {
      token: ownerToken,
      payload: { userId: grantee.id, actorId: owner.id },
    });
    expect(dupRes.statusCode).toBe(409);

    await app.close();
  });

  it("revocar acceso inexistente devuelve 404", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    const revokeRes = await inject(app, "DELETE", `/api/v1/documents/${doc.id}/access/${owner.id}`, {
      token: ownerToken,
    });
    expect(revokeRes.statusCode).toBe(404);

    await app.close();
  });

  it("admin ve restricted sin necesidad de grant explícito", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const ownerToken = generateToken(owner);
    const adminToken = generateToken(admin);
    const doc = await createRestrictedDoc(app, ownerToken, owner.id);

    const listRes = await inject(app, "GET", "/api/v1/documents", { token: adminToken });
    const found = listRes.json().items.find((d: { code: string }) => d.code === doc.code);
    expect(found).toBeDefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: adminToken });
    expect(detailRes.statusCode).toBe(200);

    await app.close();
  });
});
