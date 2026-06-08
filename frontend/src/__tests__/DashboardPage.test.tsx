import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './helpers'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'

const mockGetOverview = vi.fn()

vi.mock('@/api/documents', () => ({
  getOverview: (...args: unknown[]) => mockGetOverview(...args),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-001', email: 'admin@qms.com', name: 'Admin', role: 'admin' },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

const mockOverview = {
  documentsTotal: 10,
  byStatus: { draft: 3, in_review: 2, approved: 4, obsolete: 1 },
  recentAuditEvents: [
    {
      id: 'audit-1',
      timestamp: '2026-06-01T12:00:00Z',
      actorId: 'user-001',
      action: 'document.created',
      entityType: 'document' as const,
      entityId: 'doc-1',
      details: { code: 'QA-MAN-001' },
    },
    {
      id: 'audit-2',
      timestamp: '2026-06-01T10:00:00Z',
      actorId: 'user-002',
      action: 'document.approved',
      entityType: 'document' as const,
      entityId: 'doc-2',
      details: {},
    },
  ],
  pendingApprovals: [
    {
      documentId: 'doc-3',
      documentTitle: 'Procedimiento de Calidad',
      documentCode: 'QA-PRO-003',
      approverId: 'user-001',
      responsibility: 'Revisión calidad',
    },
  ],
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza título del panel', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Panel de control')).toBeInTheDocument()
  })

  it('muestra total de documentos', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('10')).toBeInTheDocument()
  })

  it('muestra skeleton mientras carga', async () => {
    mockGetOverview.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<DashboardPage />)

    const skeletons = document.querySelectorAll('.skeleton-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('muestra error si falla la carga', async () => {
    mockGetOverview.mockRejectedValue(new Error('Network error'))
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText(/Error al cargar el resumen/)).toBeInTheDocument()
  })

  it('muestra KPI cards con valores por estado', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('muestra aprobaciones pendientes', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Procedimiento de Calidad')).toBeInTheDocument()
    expect(screen.getByText('QA-PRO-003')).toBeInTheDocument()
  })

  it('muestra mensaje cuando no hay aprobaciones pendientes', async () => {
    mockGetOverview.mockResolvedValue({ ...mockOverview, pendingApprovals: [] })
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('No tienes aprobaciones pendientes')).toBeInTheDocument()
  })

  it('muestra actividad reciente', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Documento creado')).toBeInTheDocument()
    expect(screen.getAllByText('Aprobado').length).toBeGreaterThanOrEqual(1)
  })

  it('muestra accesos rápidos', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('Todos los documentos')).toBeInTheDocument()
    expect(screen.getByText('Nuevo documento')).toBeInTheDocument()
    expect(screen.getAllByText('En revisión').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Pendientes')).toBeInTheDocument()
  })

  it('KPI cards enlazan a listado filtrado', async () => {
    mockGetOverview.mockResolvedValue(mockOverview)
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      const links = screen.getAllByRole('link')
      const docLinks = links.filter((l) => l.getAttribute('href')?.includes('/documents'))
      expect(docLinks.length).toBeGreaterThan(0)
    })
  })
})
