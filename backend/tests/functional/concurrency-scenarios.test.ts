import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

describe("Escenario funcional: Concurrencia de aprobaciones simultáneas", () => {
  it("Dos aprobadores intentan aprobar el mismo documento al mismo tiempo — solo una transición es válida", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver1 = await createUser("approver");
    const approver2 = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const app1Tok = tokenOf(approver1.user);
    const app2Tok = tokenOf(approver2.user);

    // Crear documento y enviar a revisión con dos aprobadores
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-CONC-${Date.now()}`,
      title: "Documento para test de concurrencia",
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver1.user.id, approver2.user.id] },
    });

    // Lanzar dos aprobaciones concurrentes
    const results = await Promise.allSettled([
      inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
        token: app1Tok,
        payload: { approverId: approver1.user.id, decision: "approved" },
      }),
      inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
        token: app2Tok,
        payload: { approverId: approver2.user.id, decision: "approved" },
      }),
    ]);

    // Ambas deben responder 200 (cada aprobador aprueba su paso)
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    for (const result of results) {
      if (result.status === "fulfilled") {
        expect(result.value.statusCode).toBe(200);
      }
    }

    // Verificar estado final del documento
    const detailRes = await inject(app, "GET", `/api/v1/documents/${doc.id}`, { token: ownerTok });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().approvalProgress).toEqual({ approvedSteps: 2, totalSteps: 2 });
    expect(detailRes.json().status).toBe("approved");

    // Verificar que no hay duplicados en approvals
    const approvals = detailRes.json().approvals;
    expect(approvals).toHaveLength(2);
    const approverIds = approvals.map((a: { approverId: string }) => a.approverId);
    expect(approverIds).toContain(approver1.user.id);
    expect(approverIds).toContain(approver2.user.id);
    expect(approvals.every((a: { status: string }) => a.status === "approved")).toBe(true);

    // Verificar auditoría consistente
    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token: ownerTok });
    const approveEvents = auditRes.json().items.filter(
      (e: { action: string }) => e.action === "document.approved"
    );
    expect(approveEvents).toHaveLength(1);
    expect(approveEvents[0].details.to).toBe("approved");

    await teardownApp(app);
  });

  it("Mismo aprobador intenta aprobar dos veces — segunda llamada es rechazada", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const approverTok = tokenOf(approver.user);

    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-DUP-${Date.now()}`,
      title: "Documento para test de aprobación duplicada",
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });

    // Primera aprobación
    const first = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });
    expect(first.statusCode).toBe(200);

    // Segunda aprobación — el mismo aprobador ya no tiene un approval pendiente
    const second = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });
    expect(second.statusCode === 404 || second.statusCode === 422).toBe(true);

    await teardownApp(app);
  });
});
