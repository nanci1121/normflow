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
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const found = body.items.find((d: { code: string }) => d.code === "DOC-003");
    expect(found).toBeDefined();

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

  it("documento restricted no aparece en listado ni detalle", async () => {
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

    const listRes = await inject(app, "GET", "/api/v1/documents", { token });

    const found = listRes.json().items.find(
      (d: { code: string }) => d.code === "RESTRICTED-001"
    );
    expect(found).toBeUndefined();

    const detailRes = await inject(app, "GET", `/api/v1/documents/${createRes.json().id}`, { token });

    expect(detailRes.statusCode).toBe(404);

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
});
