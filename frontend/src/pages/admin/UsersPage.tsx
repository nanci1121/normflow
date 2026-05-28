import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Eye, EyeOff, Power, PowerOff } from 'lucide-react'
import { createUser, listUsers, toggleUserActive } from '@/api/users'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/LoadingSkeleton'
import { useAuth } from '@/contexts/AuthContext'
import type { User, UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  owner: 'Propietario',
  approver: 'Aprobador',
  reader: 'Lector',
}

export function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('reader')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const createMutation = useMutation({
    mutationFn: () => createUser({ email, name, password, role }),
    onSuccess: (createdUser) => {
      setEmail('')
      setName('')
      setPassword('')
      setRole('reader')
      setErrors({})

      queryClient.setQueryData<User[]>(['users'], (currentUsers = []) => {
        const withoutCreated = currentUsers.filter((existingUser) => existingUser.id !== createdUser.id)
        return [createdUser, ...withoutCreated]
      })

      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => {
      setErrors({ form: err.message })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => toggleUserActive(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!email.trim()) newErrors.email = 'El email es obligatorio'
    if (!name.trim()) newErrors.name = 'El nombre es obligatorio'
    if (!password || password.length < 8) newErrors.password = 'Mínimo 8 caracteres'
    if (!role) newErrors.role = 'Selecciona un rol'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    createMutation.mutate()
  }

  const users = data ?? []

  return (
    <div className="page-transition p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="mt-1 text-sm text-gray-500">Administración de usuarios del sistema</p>
      </div>

      {isError && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          No se pudo cargar la tabla de usuarios. {error instanceof Error ? error.message : 'Error desconocido'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Create user form */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </h2>

            {errors.form && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">!</span>
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="usuario@empresa.com"
              />
              <Input
                label="Nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                placeholder="Nombre completo"
              />
              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-[34px] text-gray-400 transition-colors hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Select
                label="Rol"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                options={[
                  { value: 'admin', label: 'Administrador' },
                  { value: 'owner', label: 'Propietario' },
                  { value: 'approver', label: 'Aprobador' },
                  { value: 'reader', label: 'Lector' },
                ]}
                error={errors.role}
              />
              <Button type="submit" isLoading={createMutation.isPending} className="w-full">
                <Plus className="h-4 w-4" />
                Crear usuario
              </Button>
            </form>
          </Card>
        </div>

        {/* Users list */}
        <div className="lg:col-span-3">
          <Card padding={false}>
            <CardHeader
              title={`Usuarios (${users.length})`}
              icon={<Users className="h-4 w-4" />}
            />
            {isLoading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="mb-1 h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                No hay usuarios creados todavía
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-medium text-primary-700 ring-1 ring-primary-200/50">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-gray-400">(tú)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-primary-200/50">
                      {ROLE_LABELS[u.role as UserRole] ?? u.role}
                    </span>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => toggleMutation.mutate(u.id)}
                        disabled={toggleMutation.isPending}
                        title={u.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          u.isActive
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {u.isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
