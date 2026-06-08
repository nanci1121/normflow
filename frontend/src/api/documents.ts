import { api } from '@/lib/api'
import type {
  DocumentSummary,
  DocumentDetail,
  OverviewData,
  AuditEvent,
  CreateDocumentInput,
} from '@/types'

export async function getOverview(): Promise<OverviewData> {
  const { data } = await api.get<OverviewData>('/overview')
  return data
}

export interface ListDocumentsParams {
  search?: string
  status?: string
  category?: string
  visibility?: string
  owner?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export async function listDocuments(params?: ListDocumentsParams): Promise<{ items: DocumentSummary[]; total: number }> {
  const { data } = await api.get<{ items: DocumentSummary[]; total: number }>('/documents', { params })
  return data
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const { data } = await api.get<DocumentDetail>(`/documents/${id}`)
  return data
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentDetail> {
  const { data } = await api.post<DocumentDetail>('/documents', input)
  return data
}

export async function submitDocument(
  id: string,
  actorId: string,
  approverIds: string[],
): Promise<DocumentDetail> {
  const { data } = await api.post<DocumentDetail>(`/documents/${id}/submit`, { actorId, approverIds })
  return data
}

export async function resolveApproval(
  id: string,
  approverId: string,
  decision: 'approved' | 'rejected',
  comment?: string,
): Promise<DocumentDetail> {
  const { data } = await api.post<DocumentDetail>(`/documents/${id}/approve`, {
    approverId,
    decision,
    comment,
  })
  return data
}

export async function signDocument(
  id: string,
  actorId: string,
  signatureValue: string,
): Promise<DocumentDetail> {
  const { data } = await api.post<DocumentDetail>(`/documents/${id}/sign`, {
    actorId,
    signatureValue,
  })
  return data
}

export async function obsoleteDocument(
  id: string,
  actorId: string,
  reason: string,
): Promise<DocumentDetail> {
  const { data } = await api.post<DocumentDetail>(`/documents/${id}/obsolete`, {
    actorId,
    reason,
  })
  return data
}

export async function getDocumentAudit(id: string): Promise<AuditEvent[]> {
  const { data } = await api.get<{ items: AuditEvent[] }>(`/documents/${id}/audit`)
  return data.items
}
