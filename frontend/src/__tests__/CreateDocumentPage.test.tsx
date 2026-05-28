import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { CreateDocumentPage } from '@/pages/documents/CreateDocumentPage'

const mockCreateDocument = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/api/documents', () => ({
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-001', email: 'admin@qms.com', name: 'Admin', role: 'admin' },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

describe('CreateDocumentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el formulario', () => {
    renderWithProviders(<CreateDocumentPage />)
    expect(screen.getByText('Nuevo documento')).toBeInTheDocument()
    expect(screen.getByText('Crear documento')).toBeInTheDocument()
  })

  it('muestra errores de validación con campos vacíos', async () => {
    renderWithProviders(<CreateDocumentPage />)
    await userEvent.click(screen.getByText('Crear documento'))

    expect(await screen.findByText('El código es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El título es obligatorio')).toBeInTheDocument()
  })

  it('llama a createDocument al enviar formulario válido', async () => {
    mockCreateDocument.mockResolvedValue({ id: 'new-doc-1' })
    renderWithProviders(<CreateDocumentPage />)

    await userEvent.type(screen.getByLabelText('Código del documento'), 'QA-TEST-001')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Procedimiento')
    await userEvent.type(screen.getByLabelText('Título'), 'Test Document')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Test description')

    const contentTextarea = screen.getByPlaceholderText('Escribe aquí el contenido del documento...')
    await userEvent.type(contentTextarea, 'Contenido de prueba')

    await userEvent.click(screen.getByText('Crear documento'))

    await waitFor(() => {
      expect(mockCreateDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'QA-TEST-001',
          title: 'Test Document',
          category: 'Procedimiento',
          content: 'Contenido de prueba',
        }),
      )
    })
  })

  it('navega al detalle tras crear exitosamente', async () => {
    mockCreateDocument.mockResolvedValue({ id: 'new-doc-1' })
    renderWithProviders(<CreateDocumentPage />)

    await userEvent.type(screen.getByLabelText('Código del documento'), 'QA-TEST-002')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Procedimiento')
    await userEvent.type(screen.getByLabelText('Título'), 'Test')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Desc')
    await userEvent.type(
      screen.getByPlaceholderText('Escribe aquí el contenido del documento...'),
      'Content',
    )
    await userEvent.click(screen.getByText('Crear documento'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/documents/new-doc-1')
    })
  })

  it('muestra error del servidor', async () => {
    mockCreateDocument.mockRejectedValue(new Error('El código ya existe'))
    renderWithProviders(<CreateDocumentPage />)

    await userEvent.type(screen.getByLabelText('Código del documento'), 'QA-EXISTING')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Procedimiento')
    await userEvent.type(screen.getByLabelText('Título'), 'Test')
    await userEvent.type(screen.getByLabelText('Descripción'), 'Desc')
    await userEvent.type(
      screen.getByPlaceholderText('Escribe aquí el contenido del documento...'),
      'Content',
    )
    await userEvent.click(screen.getByText('Crear documento'))

    expect(await screen.findByText('El código ya existe')).toBeInTheDocument()
  })
})
