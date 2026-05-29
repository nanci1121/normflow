import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

describe("Escenario funcional: Approval workflow por categoría", () => {
  it("Admin configura workflow para calidad → owner crea documento de calidad → submit usa aprobadores del workflow → aprobación secuencial en orden de pasos", async () => {
    const app = await setupApp();

    const admin = await createUser("admin");
    const reviewer1 = await createUser("approver");
    const reviewer2 = await createUser("approver");
    const owner = await createUser("owner");
    const adminTok = tokenOf(admin.user);
    const reviewer1Tok = tokenOf(reviewer1.user);
    const reviewer2Tok = tokenOf(reviewer2.user);
    const ownerTok = tokenOf(owner.user);

    // Paso 1: Admin configura workflow para categoría "quality"
    const workflowRes = await inject(app, "PUT", "/api/v1/approval-workflows/quality", {
      token: adminTok,
      payload: {
        category: "quality",
        steps: [
          { order: 1, approverId: reviewer1.user.id, responsibility: "Revisor técnico" },
          { order: 2, approverId: reviewer2.user.id, responsibility: "Aprobador final" },
        ],
        createdBy: admin.user.id,
      },
    });
    expect(workflowRes.statusCode).toBe(200);
    expect(workflowRes.json().steps).toHaveLength(2);

    // Paso 2: Owner crea documento en categoría quality
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-WORKFLOW-${Date.now()}`,
      title: "Procedimiento con flujo configurado",
      category: "quality",
    });

    // Paso 3: Owner envía a revisión SIN approverIds explícitos
    // El backend debe tomar los aprobadores del workflow configurado
    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe("in_review");
    expect(submitRes.json().approvals).toHaveLength(2);

    // Los approvals deben tener stepOrder según el workflow
    const approvals = submitRes.json().approvals;
    const step1 = approvals.find((a: { stepOrder: number }) => a.stepOrder === 1);
    const step2 = approvals.find((a: { stepOrder: number }) => a.stepOrder === 2);
    expect(step1).toBeDefined();
    expect(step1.approverId).toBe(reviewer1.user.id);
    expect(step1.status).toBe("pending");
    expect(step2).toBeDefined();
    expect(step2.approverId).toBe(reviewer2.user.id);
    expect(step2.status).toBe("pending");

    // Paso 4: Reviewer 1 aprueba (paso 1)
    const approve1Res = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: reviewer1Tok,
      payload: { approverId: reviewer1.user.id, decision: "approved" },
    });
    expect(approve1Res.statusCode).toBe(200);
    expect(approve1Res.json().status).toBe("in_review"); // sigue in_review porque falta reviewer 2

    // Verificar aprobación parcial
    const detailAfter1 = await inject(app, "GET", `/api/v1/documents/${doc.id}`, {
      token: ownerTok,
    });
    expect(detailAfter1.json().approvalProgress).toEqual({ approvedSteps: 1, totalSteps: 2 });

    // Paso 5: Reviewer 2 aprueba (paso 2) → el documento se aprueba
    const approve2Res = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: reviewer2Tok,
      payload: { approverId: reviewer2.user.id, decision: "approved" },
    });
    expect(approve2Res.statusCode).toBe(200);
    expect(approve2Res.json().status).toBe("approved");
    expect(approve2Res.json().approvalProgress).toEqual({ approvedSteps: 2, totalSteps: 2 });

    await teardownApp(app);
  });

  it("Workflow configurado, pero submit con approverIds explícitos ignora el workflow", async () => {
    const app = await setupApp();

    const admin = await createUser("admin");
    const workflowApprover = await createUser("approver");
    const explicitApprover = await createUser("approver");
    const owner = await createUser("owner");
    const adminTok = tokenOf(admin.user);
    const explicitTok = tokenOf(explicitApprover.user);
    const ownerTok = tokenOf(owner.user);

    // Configurar workflow
    await inject(app, "PUT", "/api/v1/approval-workflows/quality", {
      token: adminTok,
      payload: {
        category: "quality",
        steps: [{ order: 1, approverId: workflowApprover.user.id }],
        createdBy: admin.user.id,
      },
    });

    // Crear documento
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-EXPLICIT-${Date.now()}`,
      title: "Documento con aprobadores explícitos",
      category: "quality",
    });

    // Submit con approverIds explícitos
    const submitRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [explicitApprover.user.id] },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().approvals).toHaveLength(1);
    expect(submitRes.json().approvals[0].approverId).toBe(explicitApprover.user.id);

    // El aprobador explícito puede aprobar
    const approveRes = await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: explicitTok,
      payload: { approverId: explicitApprover.user.id, decision: "approved" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe("approved");

    await teardownApp(app);
  });
});
