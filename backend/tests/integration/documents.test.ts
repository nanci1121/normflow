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

describe("Documents API", () => {
  it("POST /api/v1/documents → 201 con versión inicial y AuditEvent", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    const res = await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "DOC-001",
        title: "Test Document",
        description: "A test document",
        category: "quality",
        standardTags: ["ISO 9001"],
        ownerId: user.id,
        content: "Document content",
        createdBy: user.id,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.code).toBe("DOC-001");
    expect(body.status).toBe("draft");
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].number).toBe(1);
    expect(body.versions[0].changeSummary).toBe("Initial version");

    const audit = await prisma.auditEvent.findMany({
      where: { entityId: body.id },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("document.created");

    await app.close();
  });

  it("POST /api/v1/documents → 409 si el código ya existe", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);
    const payload = {
      code: "DOC-002",
      title: "First",
      description: "desc",
      category: "quality",
      standardTags: [],
      ownerId: user.id,
      content: "content",
      createdBy: user.id,
    };

    await inject(app, "POST", "/api/v1/documents", { token, payload });

    const res = await inject(app, "POST", "/api/v1/documents", { token, payload });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBeDefined();

    await app.close();
  });

  it("GET /api/v1/documents → 200 con lista de documentos", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "DOC-003",
        title: "Visible Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: user.id,
        content: "content",
        createdBy: user.id,
      },
    });

    const res = await inject(app, "GET", "/api/v1/documents", { token });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeInstanceOf(Array);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const found = body.items.find((d: { code: string }) => d.code === "DOC-003");
    expect(found).toBeDefined();

    await app.close();
  });

  it("GET /api/v1/documents soporta filtros, orden y paginación", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "LIST-001",
        title: "Alpha Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: user.id,
        content: "content",
        createdBy: user.id,
      },
    });
    await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "LIST-002",
        title: "Beta Doc",
        description: "desc",
        category: "safety",
        standardTags: [],
        ownerId: user.id,
        visibility: "restricted",
        content: "content",
        createdBy: user.id,
      },
    });

    const filteredRes = await inject(
      app,
      "GET",
      "/api/v1/documents?category=safety&visibility=restricted&sortBy=title&sortOrder=asc&page=1&pageSize=1",
      { token }
    );

    expect(filteredRes.statusCode).toBe(200);
    const filteredBody = filteredRes.json();
    expect(filteredBody.total).toBe(1);
    expect(filteredBody.items).toHaveLength(1);
    expect(filteredBody.items[0].code).toBe("LIST-002");

    await app.close();
  });

  it("GET /api/v1/documents/:id → 200 con detalle del documento", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    const createRes = await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "DOC-004",
        title: "Detail Test",
        description: "desc",
        category: "quality",
        standardTags: ["ISO 14001"],
        ownerId: user.id,
        content: "content",
        createdBy: user.id,
      },
    });

    const res = await inject(app, "GET", `/api/v1/documents/${createRes.json().id}`, { token });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(createRes.json().id);
    expect(res.json().standardTags).toContain("ISO 14001");

    await app.close();
  });

  it("GET /api/v1/documents/:id → 404 si no existe", async () => {
    const app = buildApp();
    await app.ready();

    const res = await inject(app, "GET", "/api/v1/documents/non-existent-id");

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBeDefined();

    await app.close();
  });

  it("dueño ve documento restricted en listado y detalle", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    const createRes = await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "RESTRICTED-001",
        title: "Restricted Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: user.id,
        visibility: "restricted",
        content: "secret content",
        createdBy: user.id,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const docId = createRes.json().id;

    const listRes = await inject(app, "GET", "/api/v1/documents", { token });

    const found = listRes.json().items.find(
      (d: { code: string }) => d.code === "RESTRICTED-001"
    );
    expect(found).toBeDefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${docId}`, { token });

    expect(detailRes.statusCode).toBe(200);

    await app.close();
  });

  it("otro usuario no ve documento restricted en listado ni detalle", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: other } = await createTestUser(prisma);
    const ownerToken = generateToken(owner);
    const otherToken = generateToken(other);

    const createRes = await inject(app, "POST", "/api/v1/documents", {
      token: ownerToken,
      payload: {
        code: "RESTRICTED-002",
        title: "Secret Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: owner.id,
        visibility: "restricted",
        content: "secret content",
        createdBy: owner.id,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const docId = createRes.json().id;

    const listRes = await inject(app, "GET", "/api/v1/documents", { token: otherToken });

    const found = listRes.json().items.find(
      (d: { code: string }) => d.code === "RESTRICTED-002"
    );
    expect(found).toBeUndefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${docId}`, { token: otherToken });

    expect(detailRes.statusCode).toBe(404);

    await app.close();
  });

  it("admin ve documento restricted de otro usuario", async () => {
    const app = buildApp();
    await app.ready();
    const { user: owner } = await createTestUser(prisma);
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const ownerToken = generateToken(owner);
    const adminToken = generateToken(admin);

    const createRes = await inject(app, "POST", "/api/v1/documents", {
      token: ownerToken,
      payload: {
        code: "RESTRICTED-003",
        title: "Admin Visible Doc",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: owner.id,
        visibility: "restricted",
        content: "admin can see",
        createdBy: owner.id,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const docId = createRes.json().id;

    const listRes = await inject(app, "GET", "/api/v1/documents", { token: adminToken });

    const found = listRes.json().items.find(
      (d: { code: string }) => d.code === "RESTRICTED-003"
    );
    expect(found).toBeDefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${docId}`, { token: adminToken });

    expect(detailRes.statusCode).toBe(200);

    await app.close();
  });

  it("POST /api/v1/documents/:id/versions → 201 con nueva versión", async () => {
    const app = buildApp();
    await app.ready();
    const { user } = await createTestUser(prisma);
    const token = generateToken(user);

    const docRes = await inject(app, "POST", "/api/v1/documents", {
      token,
      payload: {
        code: "VERSION-001",
        title: "Version Test",
        description: "desc",
        category: "quality",
        standardTags: [],
        ownerId: user.id,
        content: "v1 content",
        createdBy: user.id,
      },
    });
    const docId = docRes.json().id;

    const res = await inject(app, "POST", `/api/v1/documents/${docId}/versions`, {
      token,
      payload: {
        title: "Version 2",
        content: "v2 content",
        changeSummary: "Updated content",
        createdBy: user.id,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().versions).toHaveLength(2);
    expect(res.json().versions[0].number).toBe(2);
    expect(res.json().versions[0].changeSummary).toBe("Updated content");
    expect(res.json().status).toBe("draft");

    await app.close();
  });

  it("GET /api/v1/users → 200 con lista de usuarios (solo admin)", async () => {
    const app = buildApp();
    await app.ready();
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const token = generateToken(admin);

    const res = await inject(app, "GET", "/api/v1/users", { token });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].isActive).toBe(true);

    await app.close();
  });

  it("POST /api/v1/users → 201 crea usuario con isActive", async () => {
    const app = buildApp();
    await app.ready();
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const token = generateToken(admin);

    const res = await inject(app, "POST", "/api/v1/users", {
      token,
      payload: {
        email: "nuevo@test.com",
        name: "Nuevo Usuario",
        password: "pass1234",
        role: "reader",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.email).toBe("nuevo@test.com");
    expect(body.isActive).toBe(true);

    await app.close();
  });

  it("PATCH /api/v1/users/:id/toggle-active → cambia isActive", async () => {
    const app = buildApp();
    await app.ready();
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const { user: target } = await createTestUser(prisma, { role: "reader" });
    const token = generateToken(admin);

    const res = await inject(app, "PATCH", `/api/v1/users/${target.id}/toggle-active`, { token });
    expect(res.statusCode).toBe(200);
    expect(res.json().isActive).toBe(false);

    const res2 = await inject(app, "PATCH", `/api/v1/users/${target.id}/toggle-active`, { token });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().isActive).toBe(true);

    await app.close();
  });

  it("PATCH /api/v1/users/:id/toggle-active → 404 si usuario no existe", async () => {
    const app = buildApp();
    await app.ready();
    const { user: admin } = await createTestUser(prisma, { role: "admin" });
    const token = generateToken(admin);

    const res = await inject(app, "PATCH", "/api/v1/users/00000000-0000-0000-0000-000000000000/toggle-active", { token });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it("POST /api/v1/users → 403 si no es admin", async () => {
    const app = buildApp();
    await app.ready();
    const { user: reader } = await createTestUser(prisma, { role: "reader" });
    const token = generateToken(reader);

    const res = await inject(app, "POST", "/api/v1/users", {
      token,
      payload: {
        email: "otro@test.com",
        name: "Otro",
        password: "pass1234",
        role: "admin",
      },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });
});
