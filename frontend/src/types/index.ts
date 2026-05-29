export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'owner' | 'approver' | 'reader'
  isActive: boolean
  mustChangePassword: boolean
}

export interface AuthTokens {
  accessToken: string
}

export interface LoginResponse {
  accessToken: string
  mustChangePassword: boolean
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface ResetPasswordInput {
  newPassword: string
}

export interface ResetPasswordResponse {
  message: string
  temporaryPassword: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export type UserRole = 'admin' | 'owner' | 'approver' | 'reader'

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'obsolete'

export interface ApprovalProgress {
  approvedSteps: number
  totalSteps: number
}

export interface DocumentSummary {
  id: string
  code: string
  title: string
  description: string
  category: string
  status: DocumentStatus
  ownerId: string
  visibility: 'internal' | 'restricted'
  createdAt: string
  updatedAt: string
  approvals: DocumentApproval[]
  approvalProgress: ApprovalProgress
}

export interface DocumentVersion {
  id: string
  number: number
  title: string
  content: string
  createdAt: string
  createdBy: string
  changeSummary: string
}

export interface DocumentApproval {
  id: string
  approverId: string
  stepOrder?: number
  responsibility?: string
  status: 'pending' | 'approved' | 'rejected'
  comment?: string
  decidedAt?: string
}

export interface ApprovalWorkflowStep {
  id: string
  stepOrder: number
  approverId: string
  approverName: string
  approverEmail: string
  responsibility: string
}

export interface ApprovalWorkflow {
  id: string
  category: string
  createdAt: string
  updatedAt: string
  steps: ApprovalWorkflowStep[]
}

export interface ApprovalWorkflowStepInput {
  approverId: string
  responsibility: string
}

export interface DocumentDetail extends DocumentSummary {
  currentVersionId: string
  obsoleteReason?: string
  standardTags: string[]
  versions: DocumentVersion[]
  approvals: DocumentApproval[]
  signatures: string[]
}

export interface AuditEvent {
  id: string
  timestamp: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  details: Record<string, unknown>
}

export interface OverviewData {
  documentsTotal: number
  byStatus: Record<string, number>
  recentAuditEvents: AuditEvent[]
}

export interface CreateDocumentInput {
  code: string
  title: string
  description: string
  category: string
  standardTags: string[]
  ownerId: string
  visibility?: 'internal' | 'restricted'
  content: string
  createdBy: string
}
