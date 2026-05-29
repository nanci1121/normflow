import { api } from '@/lib/api'
import type { LoginCredentials, User, ChangePasswordInput, LoginResponse } from '@/types'

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', credentials)
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

export async function changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  const { data } = await api.patch<{ message: string }>('/auth/change-password', input)
  return data
}
