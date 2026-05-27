export type DocumentStatus = "draft" | "in_review" | "approved" | "obsolete";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type UserRole = "admin" | "owner" | "approver" | "reader";
export type AuditAction =
  | "document.created"
  | "document.version_added"
  | "document.submitted"
  | "document.approved"
  | "document.signed"
  | "document.obsoleted";

export interface DocumentVersion {
  id: string;
  number: number;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
}

export interface DocumentApproval {
  id: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  decidedAt?: string;
}

export interface DocumentRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  standardTags: string[];
  status: DocumentStatus;
  ownerId: string;
  visibility: "internal" | "restricted";
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  versions: DocumentVersion[];
  approvals: DocumentApproval[];
  signatures: string[];
  obsoleteReason?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorId: string;
  action: AuditAction;
  entityType: "document";
  entityId: string;
  details: Record<string, unknown>;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface CreateDocumentInput {
  code: string;
  title: string;
  description: string;
  category: string;
  standardTags: string[];
  ownerId: string;
  visibility?: "internal" | "restricted";
  content: string;
  createdBy: string;
}

export interface AddVersionInput {
  title: string;
  content: string;
  changeSummary: string;
  createdBy: string;
}

export interface SubmitForApprovalInput {
  actorId: string;
  approverIds: string[];
}

export interface ResolveApprovalInput {
  actorId: string;
  approverId: string;
  comment?: string;
}

export interface SignDocumentInput {
  actorId: string;
  signatureValue: string;
}
