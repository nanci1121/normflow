import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { ApprovalWorkflowsPage } from '@/pages/admin/ApprovalWorkflowsPage'

vi.mock('@/api/approvalWorkflows', () => {
  const mockList = vi.fn()
  const mockSet = vi.fn()
  return {
    listApprovalWorkflows: mockList,
    setApprovalWorkflow: mockSet,
  }
})

vi.mock('@/api/users', () => {
  const mockList = vi.fn()
  return {
    listUsers: mockList,
  }
})

import { listApprovalWorkflows, setApprovalWorkflow } from '@/api/approvalWorkflows'
import { listUsers } from '@/api/users'

describe('ApprovalWorkflowsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    ;(listUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'approver-1',
        email: 'ana@empresa.com',
        name: 'Ana',
        role: 'approver',
        isActive: true,
      },
      {
        id: 'approver-2',
        email: 'bruno@empresa.com',
        name: 'Bruno',
        role: 'approver',
        isActive: true,
      },
      {
        id: 'approver-3',
        email: 'carla@empresa.com',
        name: 'Carla',
        role: 'approver',
        isActive: true,
      },
    ])
  })

  it('muestra workflows existentes y carga un workflow al hacer click', async () => {
    ;(listApprovalWorkflows as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'wf-1',
        category: 'Procedimiento',
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z',
        steps: [
          {
            id: 'step-1',
            stepOrder: 1,
            approverId: 'approver-1',
            approverName: 'Ana',
            approverEmail: 'ana@empresa.com',
            responsibility: 'Revisión técnica',
          },
        ],
      },
    ])

    renderWithProviders(<ApprovalWorkflowsPage />)

    const workflowButton = await screen.findByRole('button', { name: /procedimiento/i })
    await userEvent.click(workflowButton)

    expect(screen.getByLabelText('Categoría / departamento')).toHaveValue('Procedimiento')
    expect(screen.getByLabelText('Responsabilidad')).toHaveValue('Revisión técnica')
  })

  it('guarda flujo nuevo con pasos en orden', async () => {
    ;(listApprovalWorkflows as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(setApprovalWorkflow as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'wf-2',
      category: 'Procedimiento',
      createdAt: '2026-05-28T10:00:00.000Z',
      updatedAt: '2026-05-28T10:00:00.000Z',
      steps: [
        {
          id: 'step-1',
          stepOrder: 1,
          approverId: 'approver-1',
          approverName: 'Ana',
          approverEmail: 'ana@empresa.com',
          responsibility: 'Revisión documental',
        },
        {
          id: 'step-2',
          stepOrder: 2,
          approverId: 'approver-2',
          approverName: 'Bruno',
          approverEmail: 'bruno@empresa.com',
          responsibility: 'Aprobación final',
        },
      ],
    })

    renderWithProviders(<ApprovalWorkflowsPage />)

    await userEvent.selectOptions(screen.getByLabelText('Categoría / departamento'), 'Procedimiento')

    const approverSelects = screen.getAllByLabelText('Aprobador')
    await userEvent.selectOptions(approverSelects[0], 'approver-1')
    await userEvent.type(screen.getByLabelText('Responsabilidad'), 'Revisión documental')

    await userEvent.click(screen.getByRole('button', { name: /añadir paso/i }))

    const updatedApproverSelects = await screen.findAllByLabelText('Aprobador')
    const responsibilityInputs = await screen.findAllByLabelText('Responsabilidad')
    await userEvent.selectOptions(updatedApproverSelects[1], 'approver-2')
    await userEvent.type(responsibilityInputs[1], 'Aprobación final')

    await userEvent.click(screen.getByRole('button', { name: /guardar flujo/i }))

    await waitFor(() => {
      expect(setApprovalWorkflow).toHaveBeenCalledWith('Procedimiento', [
        { approverId: 'approver-1', responsibility: 'Revisión documental' },
        { approverId: 'approver-2', responsibility: 'Aprobación final' },
      ])
    })
  })

  it('valida que no se repita el mismo aprobador', async () => {
    ;(listApprovalWorkflows as ReturnType<typeof vi.fn>).mockResolvedValue([])

    renderWithProviders(<ApprovalWorkflowsPage />)

    await userEvent.selectOptions(screen.getByLabelText('Categoría / departamento'), 'Procedimiento')

    const approverSelects = screen.getAllByLabelText('Aprobador')
    await userEvent.selectOptions(approverSelects[0], 'approver-1')
    await userEvent.type(screen.getByLabelText('Responsabilidad'), 'Revisión documental')

    await userEvent.click(screen.getByRole('button', { name: /añadir paso/i }))

    const updatedApproverSelects = await screen.findAllByLabelText('Aprobador')
    const responsibilityInputs = await screen.findAllByLabelText('Responsabilidad')
    await userEvent.selectOptions(updatedApproverSelects[1], 'approver-1')
    await userEvent.type(responsibilityInputs[1], 'Aprobación final')

    await userEvent.click(screen.getByRole('button', { name: /guardar flujo/i }))

    expect(
      await screen.findByText('Un mismo usuario no puede repetirse dentro del mismo flujo'),
    ).toBeInTheDocument()
    expect(setApprovalWorkflow).not.toHaveBeenCalled()
  })
})
