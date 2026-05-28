import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitBranch, ListChecks, Plus, Save, Trash2 } from 'lucide-react'
import { listApprovalWorkflows, setApprovalWorkflow } from '@/api/approvalWorkflows'
import { listUsers } from '@/api/users'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/LoadingSkeleton'
import type { ApprovalWorkflow, ApprovalWorkflowStepInput } from '@/types'

const CATEGORIES = [
  'Manual de calidad',
  'Procedimiento',
  'Instrucción de trabajo',
  'Registro',
  'Política',
  'Plan',
  'Informe',
] as const

interface EditableStep {
  approverId: string
  responsibility: string
}

function createEmptyStep(): EditableStep {
  return { approverId: '', responsibility: '' }
}

function toEditableSteps(workflow: ApprovalWorkflow): EditableStep[] {
  return workflow.steps
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => ({ approverId: step.approverId, responsibility: step.responsibility }))
}

export function ApprovalWorkflowsPage() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('')
  const [steps, setSteps] = useState<EditableStep[]>([createEmptyStep()])
  const [formError, setFormError] = useState<string | null>(null)

  const workflowsQuery = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: listApprovalWorkflows,
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const approverOptions = useMemo(() => {
    const users = usersQuery.data ?? []
    return users
      .filter((user) => user.isActive && user.role !== 'reader')
      .map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }))
  }, [usersQuery.data])

  const saveMutation = useMutation({
    mutationFn: (payload: { category: string; steps: ApprovalWorkflowStepInput[] }) =>
      setApprovalWorkflow(payload.category, payload.steps),
    onSuccess: (savedWorkflow) => {
      setFormError(null)

      queryClient.setQueryData<ApprovalWorkflow[]>(['approval-workflows'], (current = []) => {
        const withoutCurrent = current.filter((workflow) => workflow.category !== savedWorkflow.category)
        return [savedWorkflow, ...withoutCurrent].sort((a, b) => a.category.localeCompare(b.category))
      })

      setCategory(savedWorkflow.category)
      setSteps(toEditableSteps(savedWorkflow))
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const workflows = workflowsQuery.data ?? []

  const startNewWorkflow = () => {
    setCategory('')
    setSteps([createEmptyStep()])
    setFormError(null)
  }

  const loadWorkflow = (workflow: ApprovalWorkflow) => {
    setCategory(workflow.category)
    setSteps(toEditableSteps(workflow))
    setFormError(null)
  }

  const updateStep = (index: number, next: Partial<EditableStep>) => {
    setSteps((currentSteps) =>
      currentSteps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...next } : step,
      ),
    )
  }

  const addStep = () => {
    setSteps((currentSteps) => [...currentSteps, createEmptyStep()])
  }

  const removeStep = (index: number) => {
    setSteps((currentSteps) => {
      if (currentSteps.length === 1) return currentSteps
      return currentSteps.filter((_, stepIndex) => stepIndex !== index)
    })
  }

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const normalizedCategory = category.trim()
    if (!normalizedCategory) {
      setFormError('La categoría es obligatoria')
      return
    }

    if (steps.length === 0) {
      setFormError('Debes añadir al menos un paso de aprobación')
      return
    }

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]
      if (!step.approverId) {
        setFormError(`Selecciona aprobador para el paso ${i + 1}`)
        return
      }
      if (step.responsibility.trim().length < 2) {
        setFormError(`La responsabilidad del paso ${i + 1} es obligatoria`)
        return
      }
    }

    const deduplicatedApprovers = new Set<string>()
    for (const step of steps) {
      if (deduplicatedApprovers.has(step.approverId)) {
        setFormError('Un mismo usuario no puede repetirse dentro del mismo flujo')
        return
      }
      deduplicatedApprovers.add(step.approverId)
    }

    saveMutation.mutate({
      category: normalizedCategory,
      steps: steps.map((step) => ({
        approverId: step.approverId,
        responsibility: step.responsibility.trim(),
      })),
    })
  }

  return (
    <div className="page-transition p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Flujos de aprobación</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configura listas de aprobadores por categoría con orden secuencial.
        </p>
      </div>

      {(workflowsQuery.isError || usersQuery.isError) && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          Error cargando datos. {workflowsQuery.error instanceof Error ? workflowsQuery.error.message : ''}
          {' '}
          {usersQuery.error instanceof Error ? usersQuery.error.message : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <GitBranch className="h-4 w-4" />
                  Editor de flujo
                </h2>
                <Button type="button" variant="secondary" size="sm" onClick={startNewWorkflow}>
                  Nuevo flujo
                </Button>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {formError}
                </div>
              )}

              <Select
                label="Categoría / departamento"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                placeholder="Selecciona categoría"
              />

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={`step-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Paso {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(index)}
                        disabled={steps.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Quitar
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Select
                        id={`approver-${index}`}
                        label="Aprobador"
                        value={step.approverId}
                        onChange={(event) => updateStep(index, { approverId: event.target.value })}
                        options={approverOptions}
                        placeholder="Selecciona usuario"
                      />
                      <Input
                        id={`responsibility-${index}`}
                        label="Responsabilidad"
                        value={step.responsibility}
                        onChange={(event) => updateStep(index, { responsibility: event.target.value })}
                        placeholder="Ej: Revisión técnica"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={addStep}>
                  <Plus className="h-4 w-4" />
                  Añadir paso
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Guardar flujo
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card padding={false}>
            <CardHeader title={`Listas (${workflows.length})`} icon={<ListChecks className="h-4 w-4" />} />

            {workflowsQuery.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No hay listas creadas todavía
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {workflows.map((workflow) => (
                  <li key={workflow.id} className="px-4 py-3">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
                      onClick={() => loadWorkflow(workflow)}
                    >
                      <p className="text-sm font-semibold text-gray-900">{workflow.category}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {workflow.steps.length} paso(s)
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
