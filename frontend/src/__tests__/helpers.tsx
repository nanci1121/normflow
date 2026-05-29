import { type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { User } from '@/types'

export const mockUser: User = {
  id: 'user-001',
  email: 'admin@qms.com',
  name: 'Admin User',
  role: 'admin',
  isActive: true,
  mustChangePassword: false,
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface WrapperOptions {
  initialEntries?: string[]
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: ReactNode,
  { initialEntries = ['/'], queryClient = createTestQueryClient() }: WrapperOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { ...render(<Wrapper>{ui}</Wrapper>), queryClient }
}
