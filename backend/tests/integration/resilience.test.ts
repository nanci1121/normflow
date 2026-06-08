import { describe, it, expect, vi, afterEach } from "vitest";
import { buildApp } from "../../src/app";

describe("Graceful degradation — caída de BD", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/v1/documents responde 500 sin crash cuando BD no está disponible", async () => {
    const app = buildApp();
    await app.ready();

    // Simular fallo de BD: hacer que prisma.document.findMany lance error
    // Nota: esto es un mock de integración parcial; en un escenario real
    // la desconexión ocurriría a nivel de pool TCP.
    const { prisma } = await import("../../src/db");
    vi.spyOn(prisma.document, "findMany").mockRejectedValue(new Error("Connection terminated unexpectedly"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toHaveProperty("message");
    expect(body.message).toBe("Error inesperado");

    // Verificar que NO se filtra el stack interno
    expect(body.message).not.toContain("Connection terminated");

    await app.close();
  });

  it("POST /api/v1/documents responde 500 sin crash cuando BD no está disponible", async () => {
    const app = buildApp();
    await app.ready();

    const { prisma } = await import("../../src/db");
    vi.spyOn(prisma.document, "create").mockRejectedValue(new Error("Database is shutting down"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/documents",
      payload: {
        code: "RESILIENCE-001",
        title: "Test",
        description: "test",
        category: "quality",
        standardTags: [],
        ownerId: "nonexistent",
        visibility: "internal",
        content: "test content",
        createdBy: "nonexistent",
      },
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body).toHaveProperty("message");
    expect(body.message).not.toContain("Database is shutting down");

    await app.close();
  });

  it("El proceso Fastify no crashea tras un error de BD y sigue respondiendo", async () => {
    const app = buildApp();
    await app.ready();

    const { prisma } = await import("../../src/db");

    // Fallo simulado
    vi.spyOn(prisma.document, "findMany").mockRejectedValue(new Error("Simulated failure"));

    const failRes = await app.inject({
      method: "GET",
      url: "/api/v1/documents",
    });
    expect(failRes.statusCode).toBe(500);

    // Restaurar mock
    vi.restoreAllMocks();

    // El servidor sigue vivo
    const healthRes = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json().status).toBe("ok");

    await app.close();
  });
});
