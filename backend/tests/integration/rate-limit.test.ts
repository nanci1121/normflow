import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app";
import { createTestUser, generateToken } from "../helpers/factory";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/db";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("Rate limiting", () => {
  it("Login con muchas peticiones seguidas desde mismo actor recibe 429", async () => {
    const SAME_EMAIL = `ratelimit-${Date.now()}@test.com`;
    await createTestUser(prisma, { email: SAME_EMAIL, role: "reader" });

    const promises = Array.from({ length: 15 }, () =>
      app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: SAME_EMAIL, password: "password123" },
        headers: { "content-type": "application/json" },
      })
    );

    const results = await Promise.all(promises);
    const statusCodes = results.map((r) => r.statusCode);
    const okCount = statusCodes.filter((c) => c === 200).length;
    const rateLimited = statusCodes.filter((c) => c === 429).length;

    expect(okCount).toBeGreaterThan(0);
    expect(rateLimited).toBeGreaterThan(0);

    // Verificar headers de rate limit en la primera respuesta con 429
    const firstLimited = results.find((r) => r.statusCode === 429);
    expect(firstLimited).toBeDefined();
    expect(firstLimited!.headers["x-ratelimit-limit"]).toBeDefined();
    expect(firstLimited!.headers["x-ratelimit-remaining"]).toBe("0");
    expect(firstLimited!.json().message).toBe("Demasiadas solicitudes. Intente de nuevo más tarde.");
  });

  it("Endpoint crítico /documents/:id/approve también está limitado", async () => {
    const user = await createTestUser(prisma, { role: "owner" });
    const token = generateToken(user.user);
    const SAME_DOC_ID = `ratelimit-doc-${Date.now()}`;

    // Crear documento de prueba directamente
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/documents",
      payload: {
        code: SAME_DOC_ID,
        title: "Rate Limit Test",
        description: "test",
        category: "quality",
        standardTags: [],
        ownerId: user.user.id,
        visibility: "internal",
        content: "test",
        createdBy: user.user.id,
      },
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const doc = createRes.json();

    // Enviar a revisión
    await app.inject({
      method: "POST",
      url: `/api/v1/documents/${doc.id}/submit`,
      payload: { actorId: user.user.id, approverIds: [user.user.id] },
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });

    // Hacer muchas peticiones de approve (aunque fallen por estado, el rate limit debe activarse)
    const promises = Array.from({ length: 15 }, () =>
      app.inject({
        method: "POST",
        url: `/api/v1/documents/${doc.id}/approve`,
        payload: { approverId: user.user.id, decision: "approved" },
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      })
    );

    const results = await Promise.all(promises);
    const rateLimited = results.some((r) => r.statusCode === 429);
    expect(rateLimited).toBe(true);
  });
});
