import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { DocumentsListPage } from '@/pages/documents/DocumentsListPage'

const mockListDocuments = vi.fn()

vi.mock('@/api/documents', () => ({
  listDocuments: (...args: unknown[]) => mockListDocuments(...args),
}))

const mockDocs = [
  {
    id: 'doc-1',
    code: 'QA-MAN-001',
    title: 'Manual de Calidad',
    description: 'Descripción del manual',
    category: 'Manual de calidad',
    status: 'approved' as const,
    ownerId: 'user-001',
    visibility: 'internal' as const,
    standardTags: ['calidad', 'iso-9001'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-05-27T00:00:00Z',
    approvals: [
      {
        id: 'app-1',
        approverId: 'user-003',
        stepOrder: 1,
        responsibility: 'QA Review',
        status: 'approved' as const,
        comment: 'OK',
        decidedAt: '2026-05-26T00:00:00Z',
      },
    ],
    approvalProgress: { approvedSteps: 1, totalSteps: 1 },
  },
  {
    id: 'doc-2',
    code: 'QA-PRO-002',
    title: 'Procedimiento de Auditoría',
    description: 'Procedimiento interno',
    category: 'Procedimiento',
    status: 'draft' as const,
    ownerId: 'user-002',
    visibility: 'internal' as const,
    standardTags: ['auditoria'],
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-26T00:00:00Z',
    approvals: [],
    approvalProgress: { approvedSteps: 0, totalSteps: 0 },
  },
]

describe('DocumentsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el título y botón de crear', async () => {
    mockListDocuments.mockResolvedValue([])
    renderWithProviders(<DocumentsListPage />)
    expect(screen.getByText('Documentos')).toBeInTheDocument()
    expect(screen.getByText('Nuevo documento')).toBeInTheDocument()
  })

  it('muestra skeleton mientras carga', async () => {
    mockListDocuments.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<DocumentsListPage />)
    expect(screen.getByText('Documentos')).toBeInTheDocument()
    const skeletons = document.querySelectorAll('.skeleton-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('muestra lista de documentos', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('QA-MAN-001')).toBeInTheDocument()
    expect(screen.getByText('Manual de Calidad')).toBeInTheDocument()
    expect(screen.getByText('QA-PRO-002')).toBeInTheDocument()
  })

  it('muestra estado vacío cuando no hay documentos', async () => {
    mockListDocuments.mockResolvedValue([])
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('No hay documentos todavía')).toBeInTheDocument()
    expect(screen.getByText('Crear primer documento')).toBeInTheDocument()
  })

  it('filtra por estado', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('QA-MAN-001')).toBeInTheDocument()
    expect(screen.getByText('QA-PRO-002')).toBeInTheDocument()

    const statusSelect = screen.getByDisplayValue('Todos los estados')
    await userEvent.selectOptions(statusSelect, 'draft')

    expect(screen.queryByText('QA-MAN-001')).not.toBeInTheDocument()
    expect(screen.getByText('QA-PRO-002')).toBeInTheDocument()
  })

  it('enlaces a detalle funcionan', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    await waitFor(() => {
      const links = screen.getAllByText('Ver detalle')
      expect(links).toHaveLength(2)
    })
    expect(screen.getAllByText('Ver detalle')[0]).toHaveAttribute('href', '/documents/doc-1')
  })

  it('columna Flujo: muestra Completo para documento aprobado', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('Completo')).toBeInTheDocument()
    expect(screen.getByText('Flujo')).toBeInTheDocument()
  })

  it('columna Flujo: muestra Sin flujo para draft sin aprobaciones', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('Sin flujo')).toBeInTheDocument()
  })

  it('columna Flujo: muestra progreso parcial para in_review', async () => {
    const inReviewDocs = [
      {
        ...mockDocs[0],
        id: 'doc-3',
        code: 'QA-REV-003',
        status: 'in_review' as const,
        approvalProgress: { approvedSteps: 1, totalSteps: 3 },
        approvals: [
          { id: 'a1', approverId: 'u1', stepOrder: 1, status: 'approved' as const },
          { id: 'a2', approverId: 'u2', stepOrder: 2, status: 'pending' as const },
          { id: 'a3', approverId: 'u3', stepOrder: 3, status: 'pending' as const },
        ],
      },
    ]
    mockListDocuments.mockResolvedValue(inReviewDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('Paso 2/3')).toBeInTheDocument()
  })

  it('columna Flujo: muestra circuito cuando approvalCircuit está presente', async () => {
    const docsWithCircuit = [
      {
        ...mockDocs[0],
        approvalCircuit: {
          workflowId: 'wf-1',
          category: 'Manual de calidad',
          steps: [
            { id: 's1', stepOrder: 1, approverId: 'u1', approverName: 'QA Approver', approverEmail: 'qa@test.com', responsibility: 'QA Review' },
          ],
        },
      },
      {
        ...mockDocs[1],
        approvalCircuit: {
          workflowId: 'wf-2',
          category: 'Procedimiento',
          steps: [
            { id: 's2', stepOrder: 1, approverId: 'u2', approverName: 'R&D Approver', approverEmail: 'rd@test.com', responsibility: 'R&D Validation' },
            { id: 's3', stepOrder: 2, approverId: 'u3', approverName: 'Final Approver', approverEmail: 'final@test.com', responsibility: 'Final Approval' },
          ],
        },
      },
    ]
    mockListDocuments.mockResolvedValue(docsWithCircuit)
    renderWithProviders(<DocumentsListPage />)

    await waitFor(() => {
      const circuitBadges = screen.getAllByText((_content, element) => {
        return element.className?.includes?.('bg-primary-50') ?? false
      })
      expect(circuitBadges.length).toBe(2)
    })
  })

  it('columna Flujo: muestra Sin circuito cuando no hay approvalCircuit', async () => {
    mockListDocuments.mockResolvedValue(mockDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findAllByText('Sin circuito')).toHaveLength(2)
  })

  it('columna Flujo: muestra progreso numérico sin stepOrder', async () => {
    const flatDocs = [
      {
        ...mockDocs[0],
        id: 'doc-4',
        code: 'QA-FLAT-004',
        status: 'in_review' as const,
        approvalProgress: { approvedSteps: 1, totalSteps: 2 },
        approvals: [
          { id: 'a1', approverId: 'u1', status: 'approved' as const },
          { id: 'a2', approverId: 'u2', status: 'pending' as const },
        ],
      },
    ]
    mockListDocuments.mockResolvedValue(flatDocs)
    renderWithProviders(<DocumentsListPage />)

    expect(await screen.findByText('1/2')).toBeInTheDocument()
  })
})
