import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { LoginPage } from '@/pages/auth/LoginPage'

const mockLogin = vi.fn()
const mockChangePassword = vi.fn()
const mockClearMustChangePassword = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/api/auth')>('@/api/auth')
  return {
    ...actual,
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
  }
})

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    mustChangePassword: false,
    login: (...args: unknown[]) => mockLogin(...args),
    logout: vi.fn(),
    clearMustChangePassword: (...args: unknown[]) => mockClearMustChangePassword(...args),
  }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el formulario de login', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
    expect(screen.getByText('Entrar')).toBeInTheDocument()
  })

  it('navega a dashboard si mustChangePassword=false', async () => {
    mockLogin.mockResolvedValue(false)

    renderWithProviders(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('usuario@empresa.com'), 'admin@qms.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
    await userEvent.click(screen.getByText('Entrar'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('no navega si mustChangePassword=true (modal forzado)', async () => {
    mockLogin.mockResolvedValue(true)

    renderWithProviders(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('usuario@empresa.com'), 'admin@qms.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
    await userEvent.click(screen.getByText('Entrar'))

    await waitFor(() => {
      expect(screen.getByText('Cambio de contraseña requerido')).toBeInTheDocument()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('cambia contraseña desde el modal forzado y navega', async () => {
    mockLogin.mockResolvedValue(true)
    mockChangePassword.mockResolvedValue({ message: 'Contraseña cambiada correctamente' })

    renderWithProviders(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('usuario@empresa.com'), 'admin@qms.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password123')
    await userEvent.click(screen.getByText('Entrar'))

    await waitFor(() => {
      expect(screen.getByText('Cambio de contraseña requerido')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'password123')
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'newSecurePass')
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'newSecurePass')

    await userEvent.click(screen.getByText('Cambiar contraseña'))

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        currentPassword: 'password123',
        newPassword: 'newSecurePass',
      })
      expect(mockClearMustChangePassword).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('muestra error del servidor en login fallido', async () => {
    mockLogin.mockRejectedValue({
      response: { data: { message: 'Credenciales inválidas' } },
    })

    renderWithProviders(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('usuario@empresa.com'), 'wrong@qms.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'wrongpass')
    await userEvent.click(screen.getByText('Entrar'))

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument()
    })
  })
})
