import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import {
  AuditEvent,
  CreateDocumentInput,
  DocumentRecord,
  AddVersionInput,
  SubmitForApprovalInput,
  ResolveApprovalInput,
  SignDocumentInput,
} from "./types";

function toIsoString(date: Date): string {
  return date.toISOString();
}

function mapDocument(
  doc: Awaited<ReturnType<typeof prisma.document.findUnique>> & {
    versions: Awaited<ReturnType<typeof prisma.documentVersion.findMany>>;
    approvals: Awaited<ReturnType<typeof prisma.documentApproval.findMany>>;
  }
): DocumentRecord {
  return {
    id: doc!.id,
    code: doc!.code,
    title: doc!.title,
    description: doc!.description,
    category: doc!.category,
    standardTags: doc!.standardTags,
    status: doc!.status as DocumentRecord["status"],
    ownerId: doc!.ownerId,
    visibility: doc!.visibility as "internal" | "restricted",
    createdAt: toIsoString(doc!.createdAt),
    updatedAt: toIsoString(doc!.updatedAt),
    currentVersionId: doc!.currentVersionId,
    obsoleteReason: doc!.obsoleteReason ?? undefined,
    versions: doc!.versions.map((v) => ({
      id: v.id,
      number: v.number,
      title: v.title,
      content: v.content,
      createdAt: toIsoString(v.createdAt),
      createdBy: v.createdBy,
      changeSummary: v.changeSummary,
    })),
    approvals: doc!.approvals.map((a) => ({
      id: a.id,
      approverId: a.approverId,
      status: a.status as "pending" | "approved" | "rejected",
      comment: a.comment ?? undefined,
      decidedAt: a.decidedAt ? toIsoString(a.decidedAt) : undefined,
    })),
    signatures: doc!.signatures,
  };
}

function mapAuditEvent(event: Awaited<ReturnType<typeof prisma.auditEvent.findMany>>[number]): AuditEvent {
  return {
    id: event.id,
    timestamp: toIsoString(event.timestamp),
    actorId: event.actorId,
    action: event.action as AuditEvent["action"],
    entityType: event.entityType as "document",
    entityId: event.entityId,
    details: event.details as Record<string, unknown>,
  };
}

export class DocumentStore {
  async listDocuments(query?: string): Promise<DocumentRecord[]> {
    const normalizedQuery = query?.trim().toLowerCase();
    const documents = await prisma.document.findMany({
      where: { visibility: "internal" },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!normalizedQuery) {
      return documents.map((d) => mapDocument(d as never));
    }

    return documents
      .filter((doc) => {
        const haystack = [
          doc.code,
          doc.title,
          doc.description,
          doc.category,
          doc.status,
          doc.ownerId,
          ...doc.standardTags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map((d) => mapDocument(d as never));
  }

  async getDocument(id: string): Promise<DocumentRecord | undefined> {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    if (!document || document.visibility === "restricted") return undefined;
    return mapDocument(document as never);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
    const documentId = randomUUID();
    const versionId = randomUUID();

    const document = await prisma.document.create({
      data: {
        id: documentId,
        code: input.code,
        title: input.title,
        description: input.description,
        category: input.category,
        standardTags: input.standardTags,
        ownerId: input.ownerId,
        visibility: input.visibility ?? "internal",
        currentVersionId: versionId,
        versions: {
          create: {
            id: versionId,
            number: 1,
            title: input.title,
            content: input.content,
            createdBy: input.createdBy,
            changeSummary: "Initial version",
          },
        },
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: input.createdBy,
        action: "document.created",
        entityId: documentId,
        entityType: "document",
        details: {
          code: input.code,
          category: input.category,
        },
      },
    });

    return mapDocument(document as never);
  }

  async addVersion(documentId: string, input: AddVersionInput): Promise<DocumentRecord> {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento no encontrado: ${documentId}`);

    const versionCount = await prisma.documentVersion.count({ where: { documentId } });
    const versionId = randomUUID();
    const versionNumber = versionCount + 1;

    await prisma.documentVersion.create({
      data: {
        id: versionId,
        number: versionNumber,
        title: input.title,
        content: input.content,
        createdBy: input.createdBy,
        changeSummary: input.changeSummary,
        documentId,
      },
    });

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        currentVersionId: versionId,
        title: input.title,
        status: "draft",
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: input.createdBy,
        action: "document.version_added",
        entityId: documentId,
        entityType: "document",
        details: { versionNumber, changeSummary: input.changeSummary },
      },
    });

    return mapDocument(updated as never);
  }

  async submitForApproval(documentId: string, input: SubmitForApprovalInput): Promise<DocumentRecord> {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento no encontrado: ${documentId}`);

    await prisma.documentApproval.createMany({
      data: input.approverIds.map((approverId) => ({
        id: randomUUID(),
        approverId,
        status: "pending",
        documentId,
      })),
    });

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { status: "in_review" },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "document.submitted",
        entityId: documentId,
        entityType: "document",
        details: { approvers: input.approverIds },
      },
    });

    return mapDocument(updated as never);
  }

  async resolveApproval(documentId: string, input: ResolveApprovalInput): Promise<DocumentRecord> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { approvals: true },
    });

    if (!document) throw new Error(`Documento no encontrado: ${documentId}`);

    const approval = document.approvals.find((a) => a.approverId === input.approverId);
    if (!approval) throw new Error(`No existe una aprobación pendiente para ${input.approverId}`);

    const now = new Date();
    await prisma.documentApproval.update({
      where: { id: approval.id },
      data: {
        status: "approved",
        comment: input.comment,
        decidedAt: now,
      },
    });

    const allApprovals = await prisma.documentApproval.findMany({ where: { documentId } });
    const allApproved = allApprovals.every((a) => a.status === "approved");

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: allApproved ? "approved" : undefined,
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "document.approved",
        entityId: documentId,
        entityType: "document",
        details: { approverId: input.approverId, comment: input.comment },
      },
    });

    return mapDocument(updated as never);
  }

  async signDocument(documentId: string, input: SignDocumentInput): Promise<DocumentRecord> {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento no encontrado: ${documentId}`);

    const signature = `${input.actorId}:${input.signatureValue}`;
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        signatures: { push: signature },
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: "document.signed",
        entityId: documentId,
        entityType: "document",
        details: { signatureValue: input.signatureValue },
      },
    });

    return mapDocument(updated as never);
  }

  async obsoleteDocument(documentId: string, actorId: string, reason: string): Promise<DocumentRecord> {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento no encontrado: ${documentId}`);

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "obsolete",
        obsoleteReason: reason,
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId,
        action: "document.obsoleted",
        entityId: documentId,
        entityType: "document",
        details: { reason },
      },
    });

    return mapDocument(updated as never);
  }

  async getAuditEvents(documentId?: string): Promise<AuditEvent[]> {
    const events = await prisma.auditEvent.findMany({
      where: documentId ? { entityId: documentId } : undefined,
      orderBy: { timestamp: "desc" },
    });

    return events.map((event) => mapAuditEvent(event));
  }
}
