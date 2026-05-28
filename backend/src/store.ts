import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { Prisma } from "./generated/prisma/client";
import {
  AuditEvent,
  ApprovalWorkflowRecord,
  ApprovalWorkflowStepInput,
  CreateDocumentInput,
  DocumentRecord,
  AddVersionInput,
  SubmitForApprovalInput,
  ResolveApprovalInput,
  SignDocumentInput,
  HttpError,
  DocumentStatus,
  UserContext,
} from "./types";
import type { EmailService } from "./email";
import { submissionEmail, approvalAssignedEmail, approvedEmail, rejectedEmail } from "./email/templates";

interface ResolvedApproverStep {
  approverId: string;
  responsibility: string;
}

const VALID_TRANSITIONS: Record<string, DocumentStatus[]> = {
  submit: ["draft"],
  approve: ["in_review"],
  reject: ["in_review"],
  obsolete: ["approved"],
};

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
      stepOrder: a.stepOrder ?? undefined,
      responsibility: a.responsibility ?? undefined,
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

function mapApprovalWorkflow(
  workflow: Awaited<ReturnType<typeof prisma.approvalWorkflow.findMany>>[number] & {
    steps: Array<
      Awaited<ReturnType<typeof prisma.approvalWorkflowStep.findMany>>[number] & {
        approver: { id: string; name: string; email: string };
      }
    >;
  }
): ApprovalWorkflowRecord {
  return {
    id: workflow.id,
    category: workflow.category,
    createdAt: toIsoString(workflow.createdAt),
    updatedAt: toIsoString(workflow.updatedAt),
    steps: workflow.steps
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        approverId: step.approverId,
        approverName: step.approver.name,
        approverEmail: step.approver.email,
        responsibility: step.responsibility,
      })),
  };
}

export class DocumentStore {
  constructor(private emailService?: EmailService) {}

  private async sendEmail(opts: { to: string[]; subject: string; html: string }): Promise<void> {
    if (!this.emailService) return;
    try {
      await this.emailService.send(opts);
    } catch {
      // Log error but don't fail the operation
    }
  }

  private async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email;
  }
  private canViewDocument(
    doc: { visibility: string; ownerId: string },
    user?: UserContext
  ): boolean {
    if (doc.visibility !== "restricted") return true;
    if (!user) return false;
    if (user.role === "admin") return true;
    return doc.ownerId === user.id;
  }

  async listDocuments(query?: string, user?: UserContext): Promise<DocumentRecord[]> {
    const normalizedQuery = query?.trim().toLowerCase();
    const documents = await prisma.document.findMany({
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = documents.filter((doc) => this.canViewDocument(doc, user));

    if (!normalizedQuery) {
      return filtered.map((d) => mapDocument(d as never));
    }

    return filtered
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

  async getDocument(id: string, user?: UserContext): Promise<DocumentRecord | undefined> {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    if (!document || !this.canViewDocument(document, user)) return undefined;
    return mapDocument(document as never);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
    const documentId = randomUUID();
    const versionId = randomUUID();

    let document;
    try {
      document = await prisma.document.create({
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
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "El código del documento ya existe");
      }
      throw error;
    }

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

  async listApprovalWorkflows(): Promise<ApprovalWorkflowRecord[]> {
    const workflows = await prisma.approvalWorkflow.findMany({
      include: {
        steps: {
          include: {
            approver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
      orderBy: { category: "asc" },
    });

    return workflows.map((workflow) => mapApprovalWorkflow(workflow as never));
  }

  async setApprovalWorkflow(
    category: string,
    steps: ApprovalWorkflowStepInput[],
    actorId: string
  ): Promise<ApprovalWorkflowRecord> {
    const normalizedCategory = category.trim().toLowerCase();
    if (!normalizedCategory) {
      throw new HttpError(422, "La categoría es obligatoria");
    }
    if (steps.length === 0) {
      throw new HttpError(422, "Debe configurar al menos un aprobador");
    }

    const dedupedApproverIds = [...new Set(steps.map((step) => step.approverId))];
    if (dedupedApproverIds.length !== steps.length) {
      throw new HttpError(409, "Un usuario no puede repetirse dentro del mismo flujo");
    }

    const users = await prisma.user.findMany({
      where: { id: { in: dedupedApproverIds }, isActive: true },
      select: { id: true },
    });

    if (users.length !== dedupedApproverIds.length) {
      throw new HttpError(404, "Uno o más aprobadores no existen o están inactivos");
    }

    const workflow = await prisma.$transaction(async (tx) => {
      const upserted = await tx.approvalWorkflow.upsert({
        where: { category: normalizedCategory },
        create: { category: normalizedCategory },
        update: {},
      });

      await tx.approvalWorkflowStep.deleteMany({ where: { workflowId: upserted.id } });

      await tx.approvalWorkflowStep.createMany({
        data: steps.map((step, index) => ({
          id: randomUUID(),
          workflowId: upserted.id,
          stepOrder: index + 1,
          approverId: step.approverId,
          responsibility: step.responsibility.trim(),
        })),
      });

      await tx.auditEvent.create({
        data: {
          actorId,
          action: "approval.workflow_updated",
          entityId: upserted.id,
          entityType: "approval_workflow",
          details: {
            category: normalizedCategory,
            steps: steps.map((step, index) => ({
              stepOrder: index + 1,
              approverId: step.approverId,
              responsibility: step.responsibility.trim(),
            })),
          },
        },
      });

      return tx.approvalWorkflow.findUniqueOrThrow({
        where: { id: upserted.id },
        include: {
          steps: {
            include: {
              approver: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { stepOrder: "asc" },
          },
        },
      });
    });

    return mapApprovalWorkflow(workflow as never);
  }

  private async resolveApproverSteps(
    documentId: string,
    input: SubmitForApprovalInput
  ): Promise<ResolvedApproverStep[]> {
    const explicitApproverIds = (input.approverIds ?? []).filter((id) => id.trim().length > 0);
    if (explicitApproverIds.length > 0) {
      return [...new Set(explicitApproverIds)].map((approverId) => ({
        approverId,
        responsibility: "Manual approval",
      }));
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { category: true },
    });

    if (!document) {
      throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    }

    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { category: document.category.toLowerCase() },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!workflow || workflow.steps.length === 0) {
      throw new HttpError(
        422,
        `No hay flujo de aprobación configurado para la categoría ${document.category}`
      );
    }

    return workflow.steps.map((step) => ({
      approverId: step.approverId,
      responsibility: step.responsibility,
    }));
  }

  private async checkDocumentAccess(documentId: string, actorId: string): Promise<void> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, visibility: true, ownerId: true },
    });
    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    if (document.visibility !== "restricted") return;
    if (document.ownerId !== actorId) {
      throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    }
  }

  async addVersion(documentId: string, input: AddVersionInput): Promise<DocumentRecord> {
    await this.checkDocumentAccess(documentId, input.createdBy);
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);

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
    await this.checkDocumentAccess(documentId, input.actorId);
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    if (!VALID_TRANSITIONS.submit.includes(document.status as DocumentStatus)) {
      throw new HttpError(422, `No se puede enviar a revisión un documento en estado ${document.status}`);
    }

    const resolvedApproverSteps = await this.resolveApproverSteps(documentId, input);
    const uniqueApproverIds = resolvedApproverSteps.map((step) => step.approverId);

    await prisma.documentApproval.deleteMany({
      where: {
        documentId,
        approverId: { in: uniqueApproverIds },
        status: "rejected",
      },
    });

    const existing = await prisma.documentApproval.findFirst({
      where: { documentId, approverId: { in: uniqueApproverIds }, status: "pending" },
    });
    if (existing) {
      throw new HttpError(409, "Uno o más aprobadores ya están asignados a este documento");
    }

    await prisma.documentApproval.createMany({
      data: resolvedApproverSteps.map((step, index) => ({
        id: randomUUID(),
        approverId: step.approverId,
        stepOrder: index + 1,
        responsibility: step.responsibility,
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
        details: {
          from: "draft",
          to: "in_review",
          approvers: uniqueApproverIds,
          source: input.approverIds && input.approverIds.length > 0 ? "manual" : "workflow",
        },
      },
    });

    const ownerEmail = await this.getUserEmail(document.ownerId);
    if (ownerEmail) {
      const email = submissionEmail(document.code, document.title, input.actorId);
      await this.sendEmail({ to: [ownerEmail], ...email });
    }

    for (const approverId of uniqueApproverIds) {
      const approverEmail = await this.getUserEmail(approverId);
      if (approverEmail) {
        const email = approvalAssignedEmail(document.code, document.title, input.actorId);
        await this.sendEmail({ to: [approverEmail], ...email });
      }
    }

    return mapDocument(updated as never);
  }

  async resolveApproval(documentId: string, input: ResolveApprovalInput): Promise<DocumentRecord> {
    await this.checkDocumentAccess(documentId, input.actorId);
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { approvals: true },
    });

    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    if (!VALID_TRANSITIONS.approve.includes(document.status as DocumentStatus) &&
        !VALID_TRANSITIONS.reject.includes(document.status as DocumentStatus)) {
      throw new HttpError(422, `No se puede resolver aprobación de un documento en estado ${document.status}`);
    }

    if (input.actorId !== input.approverId && input.actorRole !== "admin") {
      throw new HttpError(403, "No autorizado: solo el aprobador asignado puede decidir");
    }

    const approval = document.approvals.find((a) => a.approverId === input.approverId);
    if (!approval) throw new HttpError(404, `No existe una aprobación pendiente para ${input.approverId}`);
    if (approval.status !== "pending") {
      throw new HttpError(409, `La aprobación para ${input.approverId} ya fue resuelta`);
    }

    const currentStepOrder = approval.stepOrder;
    if (currentStepOrder !== null) {
      const previousPendingOrRejected = document.approvals
        .filter((a) => a.stepOrder !== null && a.stepOrder < currentStepOrder)
        .some((a) => a.status !== "approved");

      if (previousPendingOrRejected) {
        throw new HttpError(422, "No se puede aprobar fuera de orden: hay pasos previos sin aprobar");
      }
    }

    const now = new Date();
    const isRejected = input.decision === "rejected";
    const newStatus = isRejected ? "rejected" : "approved";

    await prisma.documentApproval.update({
      where: { id: approval.id },
      data: {
        status: newStatus,
        comment: input.comment,
        decidedAt: now,
      },
    });

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: isRejected ? "draft" : undefined,
      },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        approvals: true,
      },
    });

    const allApprovals = await prisma.documentApproval.findMany({ where: { documentId } });
    const allApproved = allApprovals.every((a) => a.status === "approved");

    if (!isRejected && allApproved) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "approved" },
      });
      updated.status = "approved";
    }

    await prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: isRejected ? "document.rejected" : "document.approved",
        entityId: documentId,
        entityType: "document",
        details: {
          from: isRejected ? "in_review" : document.status,
          to: isRejected ? "draft" : "approved",
          approverId: input.approverId,
          comment: input.comment,
        },
      },
    });

    const ownerEmail = await this.getUserEmail(document.ownerId);
    if (ownerEmail && document.ownerId !== input.actorId) {
      const approverName = input.approverId;
      const template = isRejected
        ? rejectedEmail(document.code, document.title, approverName, input.comment)
        : approvedEmail(document.code, document.title, approverName);
      await this.sendEmail({ to: [ownerEmail], ...template });
    }

    return mapDocument({ ...updated, status: updated.status } as never);
  }

  async signDocument(documentId: string, input: SignDocumentInput): Promise<DocumentRecord> {
    await this.checkDocumentAccess(documentId, input.actorId);
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);

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
    await this.checkDocumentAccess(documentId, actorId);
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new HttpError(404, `Documento no encontrado: ${documentId}`);
    if (!reason || reason.trim().length === 0) {
      throw new HttpError(422, "Se requiere un motivo para obsolecencia");
    }
    if (!VALID_TRANSITIONS.obsolete.includes(document.status as DocumentStatus)) {
      throw new HttpError(422, `No se puede obsolecer un documento en estado ${document.status}`);
    }

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
        details: { from: "approved", to: "obsolete", reason },
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
