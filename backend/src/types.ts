export type DocumentStatus = "draft" | "in_review" | "approved" | "obsolete";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type UserRole = "admin" | "owner" | "approver" | "reader";
export type AuditAction =
  | "document.created"
  | "document.version_added"
  | "document.submitted"
  | "document.approved"
  | "document.rejected"
  | "document.signed"
  | "document.obsoleted"
  | "user.password_reset";

export interface ApprovalProgress {
  approvedSteps: number;
  totalSteps: number;
}

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
  stepOrder?: number;
  responsibility?: string;
  status: ApprovalStatus;
  comment?: string;
  decidedAt?: string;
}

export interface DocumentCircuitInfo {
  workflowId: string;
  category: string;
  steps: ApprovalWorkflowStepRecord[];
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
  approvalProgress: ApprovalProgress;
  approvalCircuit?: DocumentCircuitInfo;
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
  isActive: boolean;
  mustChangePassword: boolean;
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
  approverIds?: string[];
}

export interface ApprovalWorkflowStepRecord {
  id: string;
  stepOrder: number;
  approverId: string;
  approverName: string;
  approverEmail: string;
  responsibility: string;
}

export interface ApprovalWorkflowRecord {
  id: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  steps: ApprovalWorkflowStepRecord[];
}

export interface ApprovalWorkflowStepInput {
  approverId: string;
  responsibility: string;
}

export interface ResolveApprovalInput {
  actorId: string;
  actorRole: UserRole;
  approverId: string;
  decision: "approved" | "rejected";
  comment?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export interface SignDocumentInput {
  actorId: string;
  signatureValue: string;
}

export interface ResetPasswordInput {
  newPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface PendingApprovalItem {
  documentId: string;
  documentTitle: string;
  documentCode: string;
  approverId: string;
  responsibility?: string;
}

export interface ListDocumentsOptions {
  search?: string;
  status?: DocumentStatus;
  category?: string;
  visibility?: "internal" | "restricted";
  owner?: string;
  sortBy?: "title" | "status" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ListDocumentsResult {
  items: DocumentRecord[];
  total: number;
}

export interface UserContext {
  id: string;
  role: UserRole;
}
