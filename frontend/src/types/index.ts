export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'owner' | 'approver' | 'reader'
}

export interface AuthTokens {
  accessToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'obsolete'

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
