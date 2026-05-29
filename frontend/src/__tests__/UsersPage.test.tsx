import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from './helpers'
import { UsersPage } from '@/pages/admin/UsersPage'

const mockCreateUser = vi.fn()
const mockListUsers = vi.fn()
const mockToggleActive = vi.fn()
const mockResetPassword = vi.fn()

vi.mock('@/api/users', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
  listUsers: (...args: unknown[]) => mockListUsers(...args),
  toggleUserActive: (...args: unknown[]) => mockToggleActive(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@qms.com', name: 'Admin', role: 'admin', isActive: true, mustChangePassword: false },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListUsers.mockResolvedValue([
      { id: 'user-1', email: 'ana@test.com', name: 'Ana López', role: 'owner', isActive: true, mustChangePassword: false },
      { id: 'user-2', email: 'bruno@test.com', name: 'Bruno Ruiz', role: 'approver', isActive: true, mustChangePassword: true },
    ])
  })

  it('renderiza la lista de usuarios', async () => {
    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })
    expect(screen.getByText('Bruno Ruiz')).toBeInTheDocument()
  })

  it('muestra botón Reset password por cada usuario', async () => {
    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      const buttons = screen.getAllByText('Reset password')
      expect(buttons).toHaveLength(2)
    })
  })

  it('abre modal de reset password al hacer clic', async () => {
    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })

    const resetButtons = screen.getAllByText('Reset password')
    await userEvent.click(resetButtons[0])

    expect(screen.getByText(/Resetear contraseña de/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument()
  })

  it('envía reset password con nueva contraseña', async () => {
    mockResetPassword.mockResolvedValue({
      message: 'Contraseña restablecida correctamente',
      temporaryPassword: 'newPass123',
    })

    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })

    const resetButtons = screen.getAllByText('Reset password')
    await userEvent.click(resetButtons[0])

    const input = screen.getByLabelText('Nueva contraseña')
    await userEvent.type(input, 'newPass123')

    const resetButton = screen.getByText('Resetear')
    await userEvent.click(resetButton)

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('user-1', { newPassword: 'newPass123' })
    })

    expect(screen.getByText('Contraseña restablecida correctamente')).toBeInTheDocument()
    expect(screen.getByText('newPass123')).toBeInTheDocument()
  })

  it('deshabilita botón Resetear si contraseña < 8 caracteres', async () => {
    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })

    const resetButtons = screen.getAllByText('Reset password')
    await userEvent.click(resetButtons[0])

    const input = screen.getByLabelText('Nueva contraseña')
    await userEvent.type(input, '1234567')

    expect(screen.getByText('Resetear')).toBeDisabled()
  })

  it('cierra modal al hacer clic en Cerrar tras reset exitoso', async () => {
    mockResetPassword.mockResolvedValue({
      message: 'Contraseña restablecida correctamente',
      temporaryPassword: 'newPass123',
    })

    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText('Ana López')).toBeInTheDocument()
    })

    const resetButtons = screen.getAllByText('Reset password')
    await userEvent.click(resetButtons[0])

    const input = screen.getByLabelText('Nueva contraseña')
    await userEvent.type(input, 'newPass123')
    await userEvent.click(screen.getByText('Resetear'))

    await waitFor(() => {
      expect(screen.getByText('Contraseña restablecida correctamente')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Cerrar'))

    await waitFor(() => {
      expect(screen.queryByText('Contraseña restablecida correctamente')).not.toBeInTheDocument()
    })
  })
})
