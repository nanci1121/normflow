import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

describe("Escenario funcional: Ciclo de vida completo del documento", () => {
  it("Owner crea un documento en draft → lo envía a revisión → el aprobador lo aprueba → el owner lo obsoleta", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const approverTok = tokenOf(approver.user);

    // Paso 1: Owner crea documento
    const { status: createStatus, body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-LIFECYCLE-${Date.now()}`,
      title: "Procedimiento de Calidad - Revisión Anual",
    });
    expect(createStatus).toBe(201);
    expect(doc.status).toBe("draft");
    expect(doc.code).toMatch(/^E2E-LIFECYCLE-/);

    // Paso 2: Owner envía a revisión
    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");
    expect(submitRes.json().approvals).toHaveLength(1);
    expect(submitRes.json().approvals[0].status).toBe("pending");
    expect(submitRes.json().approvals[0].approverId).toBe(approver.user.id);

    // Paso 3: Aprobador revisa y aprueba
    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");
    expect(approveRes.json().approvals[0].status).toBe("approved");

    // Paso 4: Owner obsoleta el documento con motivo
    const obsoleteRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/obsolete`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, reason: "Reemplazado por procedimiento QMS-2026-01" },
    });
    expect(obsoleteRes.statusCode).toBe(200);
    expect(obsoleteRes.json().status).toBe("obsolete");
    expect(obsoleteRes.json().obsoleteReason).toBe("Reemplazado por procedimiento QMS-2026-01");

    // Paso 5: Verificación final — el documento aparece en el listado como obsolete
    const listRes = await inject(app, "GET", "/api/v1/documents", { token: ownerTok });
    expect(listRes.statusCode).toBe(200);
    const found = listRes.json().items.find((d: { id: string }) => d.id === doc.id);
    expect(found).toBeDefined();
    expect(found.status).toBe("obsolete");
    expect(found.approvalProgress).toEqual({ approvedSteps: 1, totalSteps: 1 });

    await teardownApp(app);
  });

  it("Owner crea → envía a revisión → aprobador rechaza → owner corrige y re-envía → aprobador aprueba → owner obsoleta", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const approverTok = tokenOf(approver.user);

    // Crear documento
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-RECOVERY-${Date.now()}`,
      title: "Informe de No Conformidad",
    });

    // Enviar a revisión
    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });

    // Aprobador rechaza con comentario
    const rejectRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "rejected", comment: "Falta el análisis de causa raíz" },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().status).toBe("draft");
    expect(rejectRes.json().approvals[0].status).toBe("rejected");
    expect(rejectRes.json().approvals[0].comment).toBe("Falta el análisis de causa raíz");

    // Owner corrige y re-envía
    const resubmitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });
    expect(resubmitRes.statusCode).toBe(200);
    expect(resubmitRes.json().status).toBe("in_review");

    // Aprobador aprueba la nueva versión
    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");

    // Verificar audit trail completo: debe tener eventos de todo el ciclo
    const auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, {
      token: ownerTok,
    });
    expect(auditRes.statusCode).toBe(200);
    const actions = auditRes.json().items.map((e: { action: string }) => e.action);
    expect(actions).toContain("document.created");
    expect(actions).toContain("document.submitted");
    expect(actions).toContain("document.rejected");
    // Después de reject, se re-envía y se aprueba
    const submitCount = actions.filter((a: string) => a === "document.submitted").length;
    expect(submitCount).toBe(2);
    expect(actions).toContain("document.approved");

    await teardownApp(app);
  });
});
