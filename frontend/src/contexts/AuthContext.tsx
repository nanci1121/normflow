import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { User, LoginCredentials } from '@/types'
import { login as apiLogin, logout as apiLogout, getMe } from '@/api/auth'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Rehydrate session from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('access_token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const { accessToken } = await apiLogin(credentials)
    localStorage.setItem('access_token', accessToken)
    const me = await getMe()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // best-effort
    }
    localStorage.removeItem('access_token')
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: user !== null, login, logout }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
