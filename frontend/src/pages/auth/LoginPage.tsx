import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, FileText, ClipboardCheck, Eye, EyeOff, Activity, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { changePassword } from '@/api/auth'

const loginSchema = z.object({
  email: z.string().email('Introduce un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormValues = z.infer<typeof loginSchema>

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es obligatoria'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>

const features = [
  { icon: FileText, label: 'Control de versiones y aprobaciones' },
  { icon: ClipboardCheck, label: 'Auditoría inmutable de cada acción' },
  { icon: ShieldCheck, label: 'Firmas electrónicas con valor legal' },
]

function ForceChangePasswordModal() {
  const { clearMustChangePassword } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onSubmit = async (values: ChangePasswordFormValues) => {
    setChangeError(null)
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      clearMustChangePassword()
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al cambiar la contraseña.'
      setChangeError(message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <KeyRound className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cambio de contraseña requerido</h3>
            <p className="text-sm text-gray-500">
              Tu administrador ha solicitado que cambies tu contraseña antes de continuar.
            </p>
          </div>
        </div>

        {changeError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">!</span>
            {changeError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="relative">
            <Input
              label="Contraseña actual"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
          </div>
          <div className="relative">
            <Input
              label="Nueva contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
          </div>
          <div className="relative">
            <Input
              label="Confirmar nueva contraseña"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show-pw"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              onChange={() => setShowPassword((v) => !v)}
            />
            <label htmlFor="show-pw" className="text-sm text-gray-500">
              Mostrar contraseñas
            </label>
          </div>
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            <KeyRound className="h-4 w-4" />
            Cambiar contraseña
          </Button>
        </form>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [forceChange, setForceChange] = useState(false)

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
      const needsChange = await login(values)
      if (needsChange) {
        setForceChange(true)
      } else {
        navigate('/dashboard', { replace: true })
      }
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
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950 px-12 py-16 text-white overflow-hidden">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary-800/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-primary-700/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary-400" />
          <span className="text-xl font-bold tracking-tight">QMS Platform</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight text-balance">
            Gestión documental
            <br />
            <span className="text-primary-400">con trazabilidad total</span>
          </h1>
          <p className="mt-4 text-lg text-primary-200">
            Plataforma certificada para ISO 9001, ISO 14001 e ISO 45001.
          </p>

          <ul className="mt-12 space-y-4">
            {features.map(({ icon: Icon, label }, i) => (
              <li
                key={label}
                className="flex items-center gap-3 text-primary-200 animate-slide-up"
                style={{ animationDelay: `${i * 100 + 200}ms` }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-800/60">
                  <Icon className="h-5 w-5 text-primary-400" />
                </div>
                <span className="text-sm">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-700">
          © {new Date().getFullYear()} QMS Platform. Todos los derechos reservados.
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ShieldCheck className="h-7 w-7 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">QMS Platform</span>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-card ring-1 ring-gray-200">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 lg:mx-0">
                <Activity className="h-6 w-6 text-primary-600" />
              </div>
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
                  className="absolute right-3 top-[34px] text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {serverError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">!</span>
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
      {forceChange && <ForceChangePasswordModal />}
    </div>
  )
}
