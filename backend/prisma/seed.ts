import "dotenv/config";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL no configurado");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seedAdmin() {
  const email = (process.env["ADMIN_EMAIL"] ?? "admin@qms.local").trim().toLowerCase();
  const name = process.env["ADMIN_NAME"] ?? "QMS Admin";
  const password = process.env["ADMIN_PASSWORD"] ?? "Admin123!";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role: "admin",
      passwordHash,
      isActive: true,
    },
    create: {
      email,
      name,
      role: "admin",
      passwordHash,
      isActive: true,
    },
  });

  console.log(`[seed] admin ready: ${admin.email}`);
}

async function seedVenancio() {
  const email = "venancio.morales@huayicompressor.es";
  const name = "Venancio Morales Valle";
  const password = "12345678";

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: "admin", passwordHash, isActive: true },
    create: { email, name, role: "admin", passwordHash, isActive: true },
  });

  console.log(`[seed] user ready: ${user.email} (${user.role})`);
}

const APPROVERS = [
  { name: "Analista Calidad 1", email: "calidad.1@qms.local" },
  { name: "Analista Calidad 2", email: "calidad.2@qms.local" },
  { name: "Analista Calidad 3", email: "calidad.3@qms.local" },
  { name: "Analista Calidad 4", email: "calidad.4@qms.local" },
  { name: "Analista Calidad 5", email: "calidad.5@qms.local" },
] as const;

async function seedApprovers() {
  const passwordHash = await bcrypt.hash("Calidad123!", 12);

  for (const a of APPROVERS) {
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: "approver", passwordHash, isActive: true },
      create: { email: a.email, name: a.name, role: "approver", passwordHash, isActive: true },
    });
    console.log(`[seed] approver ready: ${user.email} (${user.name})`);
  }
}

async function seedDemoDocuments() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@qms.local" } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "venancio.morales@huayicompressor.es" } });
  const [c1, c2, c3, c4, c5] = await Promise.all(
    APPROVERS.map((a) => prisma.user.findUniqueOrThrow({ where: { email: a.email } }))
  );

  const workflowId = randomUUID();
  await prisma.approvalWorkflow.upsert({
    where: { category: "quality" },
    update: {},
    create: {
      id: workflowId,
      category: "quality",
      steps: {
        create: [
          { id: randomUUID(), stepOrder: 1, approverId: c1.id, responsibility: "Revisor técnico" },
          { id: randomUUID(), stepOrder: 2, approverId: c2.id, responsibility: "Aprobador final" },
        ],
      },
    },
  });
  console.log("[seed] approval workflow ready: quality");

  function ago(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // ── Documento 1: Completado (approved) ──
  const d1Id = randomUUID();
  const d1vId = randomUUID();
  await prisma.document.create({
    data: {
      id: d1Id, code: "PRC-001", title: "Procedimiento de Calidad Completado",
      description: "Procedimiento completo que superó todo el circuito de aprobación",
      category: "quality", standardTags: ["iso-9001", "iso-14001"],
      status: "approved", ownerId: owner.id, visibility: "internal",
      currentVersionId: d1vId,
      createdAt: ago(5),
      versions: {
        create: {
          id: d1vId, number: 1, title: "Procedimiento de Calidad Completado",
          content: "# Procedimiento de Calidad\n\n## Alcance\nAplica a todos los procesos productivos.\n\n## Desarrollo\n1. Identificar el proceso\n2. Documentar las actividades\n3. Revisar por el equipo de calidad\n4. Aprobar por la dirección",
          createdBy: owner.id, changeSummary: "Versión inicial",
          createdAt: ago(5),
        },
      },
    },
  });
  const auditDocCreated = ago(5);
  const auditSubmitted = ago(4);
  const auditApproved1 = ago(3);
  const auditApproved2 = ago(2);
  await prisma.auditEvent.createMany({
    data: [
      { actorId: owner.id, action: "document.created", entityType: "document", entityId: d1Id, details: { code: "PRC-001", category: "quality" }, timestamp: auditDocCreated },
      { actorId: owner.id, action: "document.submitted", entityType: "document", entityId: d1Id, details: { from: "draft", to: "in_review", approvers: [c1.id, c2.id], source: "workflow" }, timestamp: auditSubmitted },
      { actorId: c1.id, action: "document.approved", entityType: "document", entityId: d1Id, details: { from: "in_review", to: "in_review", approverId: c1.id, stepOrder: 1 }, timestamp: auditApproved1 },
      { actorId: c2.id, action: "document.approved", entityType: "document", entityId: d1Id, details: { from: "in_review", to: "approved", approverId: c2.id, stepOrder: 2 }, timestamp: auditApproved2 },
    ],
  });
  await prisma.documentApproval.createMany({
    data: [
      { id: randomUUID(), documentId: d1Id, approverId: c1.id, stepOrder: 1, responsibility: "Revisor técnico", status: "approved", decidedAt: auditApproved1 },
      { id: randomUUID(), documentId: d1Id, approverId: c2.id, stepOrder: 2, responsibility: "Aprobador final", status: "approved", decidedAt: auditApproved2 },
    ],
  });
  console.log("[seed] documento 1: Procedimiento de Calidad Completado (approved)");

  // ── Documento 2: Pendiente (in_review, una aprobación sí, otra pendiente) ──
  const d2Id = randomUUID();
  const d2vId = randomUUID();
  await prisma.document.create({
    data: {
      id: d2Id, code: "IT-002", title: "Instrucción Técnica en Revisión",
      description: "Instrucción técnica pendiente de la segunda aprobación",
      category: "quality", standardTags: ["iso-9001"],
      status: "in_review", ownerId: owner.id, visibility: "internal",
      currentVersionId: d2vId,
      createdAt: ago(3),
      versions: {
        create: {
          id: d2vId, number: 1, title: "Instrucción Técnica en Revisión",
          content: "# Instrucción Técnica\n\n## Propósito\nEstandarizar el proceso de medición.\n\n## Pasos\n1. Preparar el equipo\n2. Calibrar\n3. Medir la muestra\n4. Registrar resultados",
          createdBy: owner.id, changeSummary: "Versión inicial",
          createdAt: ago(3),
        },
      },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { actorId: owner.id, action: "document.created", entityType: "document", entityId: d2Id, details: { code: "IT-002", category: "quality" }, timestamp: ago(3) },
      { actorId: owner.id, action: "document.submitted", entityType: "document", entityId: d2Id, details: { from: "draft", to: "in_review", approvers: [c3.id, c4.id], source: "workflow" }, timestamp: ago(2) },
      { actorId: c3.id, action: "document.approved", entityType: "document", entityId: d2Id, details: { from: "in_review", to: "in_review", approverId: c3.id, stepOrder: 1 }, timestamp: ago(1) },
    ],
  });
  await prisma.documentApproval.createMany({
    data: [
      { id: randomUUID(), documentId: d2Id, approverId: c3.id, stepOrder: 1, responsibility: "Revisor técnico", status: "approved", decidedAt: ago(1) },
      { id: randomUUID(), documentId: d2Id, approverId: c4.id, stepOrder: 2, responsibility: "Aprobador final", status: "pending", decidedAt: null },
    ],
  });
  console.log("[seed] documento 2: Instrucción Técnica en Revisión (in_review)");

  // ── Documento 3: Rechazado (draft tras rechazo) ──
  const d3Id = randomUUID();
  const d3vId = randomUUID();
  await prisma.document.create({
    data: {
      id: d3Id, code: "INC-003", title: "Informe de Inspección Rechazado",
      description: "Informe que fue rechazado por el aprobador final por incumplimiento normativo",
      category: "quality", standardTags: ["iso-9001", "iso-45001"],
      status: "draft", ownerId: owner.id, visibility: "internal",
      currentVersionId: d3vId,
      createdAt: ago(2),
      versions: {
        create: {
          id: d3vId, number: 1, title: "Informe de Inspección Rechazado",
          content: "# Informe de Inspección\n\n## No conformidad detectada\nSe identificaron desviaciones en el proceso de ensamblaje.\n\n## Acciones propuestas\n1. Formación al personal\n2. Actualización del procedimiento",
          createdBy: owner.id, changeSummary: "Versión inicial",
          createdAt: ago(2),
        },
      },
    },
  });
  await prisma.auditEvent.createMany({
    data: [
      { actorId: owner.id, action: "document.created", entityType: "document", entityId: d3Id, details: { code: "INC-003", category: "quality" }, timestamp: ago(2) },
      { actorId: owner.id, action: "document.submitted", entityType: "document", entityId: d3Id, details: { from: "draft", to: "in_review", approvers: [c5.id, c1.id], source: "workflow" }, timestamp: ago(1) },
      { actorId: c5.id, action: "document.approved", entityType: "document", entityId: d3Id, details: { from: "in_review", to: "in_review", approverId: c5.id, stepOrder: 1 }, timestamp: ago(0.5) },
      { actorId: c1.id, action: "document.rejected", entityType: "document", entityId: d3Id, details: { from: "in_review", to: "draft", approverId: c1.id, stepOrder: 2, comment: "No cumple con los requisitos normativos. Revisar sección 4.2" }, timestamp: ago(0.25) },
    ],
  });
  await prisma.documentApproval.createMany({
    data: [
      { id: randomUUID(), documentId: d3Id, approverId: c5.id, stepOrder: 1, responsibility: "Revisor técnico", status: "approved", decidedAt: ago(0.5) },
      { id: randomUUID(), documentId: d3Id, approverId: c1.id, stepOrder: 2, responsibility: "Aprobador final", status: "rejected", comment: "No cumple con los requisitos normativos. Revisar sección 4.2", decidedAt: ago(0.25) },
    ],
  });
  console.log("[seed] documento 3: Informe de Inspección Rechazado (draft tras rechazo)");
}

seedAdmin()
  .then(() => seedVenancio())
  .then(() => seedApprovers())
  .then(() => seedDemoDocuments())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
