import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  pathPatterns: RegExp[];
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

function getKey(request: FastifyRequest): string {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (token) return `token:${token.slice(0, 20)}`;
  return `ip:${request.ip}`;
}

export function registerRateLimit(app: FastifyInstance, options: RateLimitOptions) {
  const { maxRequests, windowMs, pathPatterns } = options;

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url;

    const matches = pathPatterns.some((p) => p.test(url));
    if (!matches) return;

    const key = getKey(request);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    reply.header("X-RateLimit-Limit", maxRequests);
    reply.header("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      return reply.code(429).send({ message: "Demasiadas solicitudes. Intente de nuevo más tarde." });
    }
  });

  // Cleanup stale entries every 60s
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 60_000);

  app.addHook("onClose", (_instance, done) => {
    clearInterval(interval);
    store.clear();
    done();
  });
}
