import { api } from '@/lib/api'
import type { DocumentSummary, OverviewData } from '@/types'

export async function getOverview(): Promise<OverviewData> {
  const { data } = await api.get<OverviewData>('/overview')
  return data
}

export async function listDocuments(search?: string): Promise<DocumentSummary[]> {
  const params = search ? { search } : {}
  const { data } = await api.get<{ items: DocumentSummary[] }>('/documents', { params })
  return data.items
}

export async function getDocument(id: string): Promise<DocumentSummary> {
  const { data } = await api.get<DocumentSummary>(`/documents/${id}`)
  return data
}
