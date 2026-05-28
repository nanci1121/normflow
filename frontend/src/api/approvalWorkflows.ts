import { api } from '@/lib/api'
import type { ApprovalWorkflow, ApprovalWorkflowStepInput } from '@/types'

export async function listApprovalWorkflows(): Promise<ApprovalWorkflow[]> {
  const { data } = await api.get<{ items: ApprovalWorkflow[] }>('/approval-workflows')
  return data.items
}

export async function setApprovalWorkflow(
  category: string,
  steps: ApprovalWorkflowStepInput[],
): Promise<ApprovalWorkflow> {
  const { data } = await api.put<ApprovalWorkflow>(
    `/approval-workflows/${encodeURIComponent(category)}`,
    { steps },
  )
  return data
}
