// Core test utilities — no circular dependency risk
import { buildApp } from "../../../src/app";
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

export async function setupApp() {
  const app = buildApp();
  await app.ready();
  return app;
}

export async function teardownApp(app: App) {
  await app.close();
}
