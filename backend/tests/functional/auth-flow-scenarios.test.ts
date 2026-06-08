import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

const JWT_SECRET = process.env["JWT_SECRET"] || "test-jwt-secret";

function shortLivedToken(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: "0s" }
  );
}

describe("Escenario funcional: Expiración JWT en flujo largo", () => {
  it("Token expirado entre submit y approve — approve devuelve 401 y no muta estado", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const expiredTok = shortLivedToken(approver.user);

    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-JWT-${Date.now()}`,
      title: "Documento para test de expiración JWT",
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });

    // Intentar approve con token expirado
    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: expiredTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(401);

    // Verificar que el documento NO cambió de estado
    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: ownerTok });
    expect(detailRes.json().status).toBe("in_review");

    // Verificar que NO se creó un AuditEvent de approve
    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token: ownerTok });
    const approveEvents = auditRes.json().items.filter(
      (e: { action: string }) => e.action === "document.approved"
    );
    expect(approveEvents).toHaveLength(0);

    await teardownApp(app);
  });

  it("Token expirado devuelve 401 en GET /auth/me", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const expiredTok = shortLivedToken(owner.user);

    const res = await inject(app, "GET", "/api/v1/auth/me", { token: expiredTok });
    expect(res.statusCode).toBe(401);

    await teardownApp(app);
  });
});
