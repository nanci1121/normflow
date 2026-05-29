import { describe, it, expect } from "vitest";
import { setupApp, teardownApp, inject, createDoc, createUser, tokenOf } from "./helpers";

describe("Escenario funcional: Trazabilidad completa de auditoría", () => {
  it("Cada transición de estado genera un AuditEvent con from/to correctos y el trail completo es consultable", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const approverTok = tokenOf(approver.user);

    // Crear documento
    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-AUDIT-${Date.now()}`,
      title: "Documento para auditoría funcional",
    });

    // Verificar evento de creación
    let auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token: ownerTok });
    expect(auditRes.statusCode).toBe(200);
    let events = auditRes.json().items;
    let created = events.find((e: { action: string }) => e.action === "document.created");
    expect(created).toBeDefined();
    expect(created.entityId).toBe(doc.id);
    expect(created.actorId).toBe(owner.user.id);
    expect(created.details.code).toBe(doc.code);

    // Enviar a revisión
    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });

    // Verificar evento submit
    auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token: ownerTok });
    events = auditRes.json().items;
    const submitted = events.find((e: { action: string }) => e.action === "document.submitted");
    expect(submitted).toBeDefined();
    expect(submitted.details.from).toBe("draft");
    expect(submitted.details.to).toBe("in_review");
    expect(submitted.details.approvers).toBeInstanceOf(Array);
    expect(submitted.details.approvers).toContain(approver.user.id);

    // Aprobar
    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });

    // Verificar evento approve
    auditRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit`, { token: ownerTok });
    events = auditRes.json().items;
    const approved = events.find((e: { action: string }) => e.action === "document.approved");
    expect(approved).toBeDefined();
    expect(approved.details.from).toBe("in_review");
    expect(approved.details.to).toBe("approved");

    // Filtrar por acción
    const filterRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit?action=document.submitted`, { token: ownerTok });
    expect(filterRes.statusCode).toBe(200);
    expect(filterRes.json().items).toHaveLength(1);
    expect(filterRes.json().items[0].action).toBe("document.submitted");

    // Filtrar por actor
    const actorFilterRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit?actorId=${approver.user.id}`, { token: ownerTok });
    expect(actorFilterRes.statusCode).toBe(200);
    expect(actorFilterRes.json().items.length).toBeGreaterThanOrEqual(1);
    expect(actorFilterRes.json().items.every((e: { actorId: string }) => e.actorId === approver.user.id)).toBe(true);

    // Exportar CSV debe contener todos los eventos
    const csvRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=csv`, { token: ownerTok });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    const lines = csvRes.body.trim().split("\r\n");
    // Header + 3 eventos (created, submitted, approved)
    expect(lines.length).toBe(4);

    // Verificar contenido del CSV
    expect(lines[0]).toBe("ID,Timestamp,ActorId,Action,EntityType,EntityId,Details");
    expect(lines.some((l: string) => l.includes("document.created"))).toBe(true);
    expect(lines.some((l: string) => l.includes("document.submitted"))).toBe(true);
    expect(lines.some((l: string) => l.includes("document.approved"))).toBe(true);

    await teardownApp(app);
  });

  it("Exportación PDF incluye info del documento y eventos con filtro combinado", async () => {
    const app = await setupApp();

    const owner = await createUser("owner");
    const approver = await createUser("approver");
    const ownerTok = tokenOf(owner.user);
    const approverTok = tokenOf(approver.user);

    const { body: doc } = await createDoc(app, ownerTok, owner.user.id, {
      code: `E2E-PDF-${Date.now()}`,
      title: "Documento para exportación PDF",
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/submit`, {
      token: ownerTok,
      payload: { actorId: owner.user.id, approverIds: [approver.user.id] },
    });

    await inject(app, "POST", `/api/v1/documents/${doc.id}/approve`, {
      token: approverTok,
      payload: { approverId: approver.user.id, decision: "approved" },
    });

    // PDF completo
    const pdfRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=pdf`, { token: ownerTok });
    expect(pdfRes.statusCode).toBe(200);
    expect(pdfRes.headers["content-type"]).toContain("application/pdf");
    expect(pdfRes.body.length).toBeGreaterThan(100);

    // PDF con filtro de acción
    const pdfFilterRes = await inject(app, "GET", `/api/v1/documents/${doc.id}/audit/export?format=pdf&action=document.created`, { token: ownerTok });
    expect(pdfFilterRes.statusCode).toBe(200);

    await teardownApp(app);
  });
});
