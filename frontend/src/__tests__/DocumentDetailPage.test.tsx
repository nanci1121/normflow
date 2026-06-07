import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { DocumentDetailPage } from '@/pages/documents/DocumentDetailPage'

const mockGetDocument = vi.fn()
const mockGetDocumentAudit = vi.fn()
const mockSubmitDocument = vi.fn()
const mockResolveApproval = vi.fn()
const mockSignDocument = vi.fn()
const mockObsoleteDocument = vi.fn()

vi.mock('@/api/documents', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  getDocumentAudit: (...args: unknown[]) => mockGetDocumentAudit(...args),
  submitDocument: (...args: unknown[]) => mockSubmitDocument(...args),
  resolveApproval: (...args: unknown[]) => mockResolveApproval(...args),
  signDocument: (...args: unknown[]) => mockSignDocument(...args),
  obsoleteDocument: (...args: unknown[]) => mockObsoleteDocument(...args),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useParams: () => ({ id: 'doc-1' }) }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-001', email: 'admin@qms.com', name: 'Admin', role: 'admin' },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

const mockDoc = {
  id: 'doc-1',
  code: 'QA-MAN-001',
  title: 'Manual de Calidad',
  description: 'Descripción del manual de calidad',
  category: 'Manual de calidad',
  standardTags: ['calidad', 'iso-9001'],
  status: 'approved' as const,
  ownerId: 'user-001',
  visibility: 'internal' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-05-27T00:00:00Z',
  currentVersionId: 'v-1',
  versions: [
    {
      id: 'v-1',
      number: 1,
      title: 'Manual de Calidad',
      content: 'Contenido de la versión 1',
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'user-001',
      changeSummary: 'Initial version',
    },
  ],
  approvals: [
    {
      id: 'app-1',
      approverId: 'user-002',
      status: 'approved' as const,
      comment: 'Aprobado',
      decidedAt: '2026-05-25T00:00:00Z',
    },
  ],
  signatures: ['user-001:firma-digital-001'],
}

describe('DocumentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra skeleton mientras carga', () => {
    mockGetDocument.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<DocumentDetailPage />)
    const skeletons = document.querySelectorAll('.skeleton-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('muestra error si no encuentra el documento', async () => {
    mockGetDocument.mockRejectedValue(new Error('Not found'))
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Documento no encontrado')).toBeInTheDocument()
  })

  it('renderiza info del documento aprobado', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    const codeElements = screen.getAllByText('QA-MAN-001')
    expect(codeElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
  })

  it('muestra botón de obsolecer en documentos aprobados', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Obsolecer')).toBeInTheDocument()
  })

  it('tab de versiones muestra historial', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Versiones'))
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('tab de firmas muestra las firmas existentes', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Firmas'))

    expect(await screen.findByText('user-001:firma-digital-001')).toBeInTheDocument()
  })

  it('tab de auditoría muestra eventos', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    mockGetDocumentAudit.mockResolvedValue([
      {
        id: 'audit-1',
        timestamp: '2026-01-01T00:00:00Z',
        actorId: 'user-001',
        action: 'document.created',
        entityType: 'document' as const,
        entityId: 'doc-1',
        details: { code: 'QA-MAN-001' },
      },
    ])
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Auditoría'))

    expect(await screen.findByText('Documento creado')).toBeInTheDocument()
  })

  it('tab de aprobaciones muestra historial', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Aprobaciones'))

    expect(await screen.findByText('user-002')).toBeInTheDocument()
    const badges = screen.getAllByText('Aprobado')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('tab de aprobaciones muestra circuito cuando approvalCircuit está presente', async () => {
    const docWithCircuit = {
      ...mockDoc,
      approvalCircuit: {
        workflowId: 'wf-1',
        category: 'Manual de calidad',
        steps: [
          { id: 's1', stepOrder: 1, approverId: 'user-002', approverName: 'QA Approver', approverEmail: 'qa@test.com', responsibility: 'Revisión calidad' },
          { id: 's2', stepOrder: 2, approverId: 'user-003', approverName: 'R&D Approver', approverEmail: 'rd@test.com', responsibility: 'Validación técnica' },
        ],
      },
    }
    mockGetDocument.mockResolvedValue(docWithCircuit)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Aprobaciones'))

    expect(await screen.findByText('Circuito de aprobación: Manual de calidad')).toBeInTheDocument()
    expect(screen.getByText('QA Approver')).toBeInTheDocument()
    expect(screen.getByText('R&D Approver')).toBeInTheDocument()
    expect(screen.getByText('Revisión calidad')).toBeInTheDocument()
    expect(screen.getByText('Validación técnica')).toBeInTheDocument()
  })

  it('draft con circuito: muestra botón de enviar a revisión con los pasos del circuito', async () => {
    const draftWithCircuit = {
      ...mockDoc,
      status: 'draft' as const,
      approvalCircuit: {
        workflowId: 'wf-1',
        category: 'Manual de calidad',
        steps: [
          { id: 's1', stepOrder: 1, approverId: 'user-002', approverName: 'QA Approver', approverEmail: 'qa@test.com', responsibility: 'Revisión calidad' },
        ],
      },
    }
    mockGetDocument.mockResolvedValue(draftWithCircuit)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Manual de Calidad')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Aprobaciones'))

    expect(await screen.findByRole('button', { name: /Enviar a revisión/i })).toBeInTheDocument()
    expect(screen.getAllByText('QA Approver').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Revisión calidad')).toBeInTheDocument()
  })

  it('necesita motivo para obsolecer', async () => {
    mockGetDocument.mockResolvedValue(mockDoc)
    renderWithProviders(<DocumentDetailPage />)

    expect(await screen.findByText('Obsolecer')).toBeDisabled()

    const reasonInput = screen.getByPlaceholderText('Motivo de obsolecencia')
    await userEvent.type(reasonInput, 'Documento reemplazado')

    expect(screen.getByText('Obsolecer')).toBeEnabled()
  })
})
