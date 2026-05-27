import { api } from '@/lib/api'
import type { AuthTokens, LoginCredentials, User } from '@/types'

export async function login(credentials: LoginCredentials): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/login', credentials)
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
