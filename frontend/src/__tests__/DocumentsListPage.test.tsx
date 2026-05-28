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
})
