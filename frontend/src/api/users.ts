import { api } from '@/lib/api'
import type { User, ResetPasswordInput, ResetPasswordResponse } from '@/types'

export interface CreateUserInput {
  email: string
  name: string
  password: string
  role: 'admin' | 'owner' | 'approver' | 'reader'
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await api.post<User>('/users', input)
  return data
}

export async function listUsers(): Promise<User[]> {
  const { data } = await api.get<{ items: User[] }>('/users')
  return data.items
}

export async function toggleUserActive(userId: string): Promise<User> {
  const { data } = await api.patch<User>(`/users/${userId}/toggle-active`)
  return data
}

export async function resetPassword(userId: string, input: ResetPasswordInput): Promise<ResetPasswordResponse> {
  const { data } = await api.patch<ResetPasswordResponse>(`/users/${userId}/reset-password`, input)
  return data
}
