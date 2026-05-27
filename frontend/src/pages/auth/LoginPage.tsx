import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, FileText, ClipboardCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'

const loginSchema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const features = [
  { icon: FileText, label: 'Control de versiones y aprobaciones' },
  { icon: ClipboardCheck, label: 'Auditoría inmutable de cada acción' },
  { icon: ShieldCheck, label: 'Firmas electrónicas con valor legal' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    try {
      await login(values)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al iniciar sesión. Inténtalo de nuevo.'
      setServerError(message)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary-950 px-12 py-16 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary-400" />
          <span className="text-xl font-bold tracking-tight">QMS Platform</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Gestión documental
            <br />
            <span className="text-primary-400">con trazabilidad total</span>
          </h1>
          <p className="mt-4 text-lg text-primary-200">
            Plataforma certificada para ISO 9001, ISO 14001 e ISO 45001.
          </p>

          <ul className="mt-12 space-y-4">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-primary-200">
                <Icon className="h-5 w-5 shrink-0 text-primary-400" />
                <span className="text-sm">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-primary-700">
          © {new Date().getFullYear()} QMS Platform. Todos los derechos reservados.
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-7 w-7 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">QMS Platform</span>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-gray-500">
                Accede con tus credenciales corporativas
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <Input
                label="Correo electrónico"
                type="email"
                autoComplete="email"
                placeholder="usuario@empresa.com"
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="relative">
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
                >
                  {serverError}
                </div>
              )}

              <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
                Entrar
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            ¿Problemas para acceder? Contacta con tu administrador de sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
