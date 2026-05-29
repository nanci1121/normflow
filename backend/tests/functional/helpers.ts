import { buildApp } from "../../src/app";
import { createTestUser, generateToken } from "../helpers/factory";
import { prisma } from "../../src/db";
import type { FastifyInstance } from "fastify";

export type App = FastifyInstance;

export async function inject(
  app: App,
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

export async function createDoc(
  app: App,
  token: string,
  ownerId: string,
  overrides?: {
    code?: string;
    title?: string;
    category?: string;
    visibility?: string;
  }
) {
  const res = await inject(app, "POST", "/api/v1/documents", {
    token,
    payload: {
      code: overrides?.code || `FUNC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: overrides?.title || "Functional Test Document",
      description: "Documento creado durante test funcional",
      category: overrides?.category || "quality",
      standardTags: [],
      ownerId,
      visibility: overrides?.visibility || "internal",
      content: "Contenido del documento de prueba",
      createdBy: ownerId,
    },
  });
  return { status: res.statusCode, body: res.json() };
}

export async function createUser(role: "owner" | "admin" | "approver" | "reader" = "owner") {
  return createTestUser(prisma, { role });
}

export function tokenOf(user: { id: string; email: string; name: string; role: string }) {
  return generateToken(user);
}

export async function setupApp() {
  const app = buildApp();
  await app.ready();
  return app;
}

export async function teardownApp(app: App) {
  await app.close();
}
