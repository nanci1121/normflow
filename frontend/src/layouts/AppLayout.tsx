import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ShieldCheck, LayoutDashboard, FileText, LogOut, User } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/documents', icon: FileText, label: 'Documentos' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col bg-primary-950 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-primary-800 px-6 py-5">
          <ShieldCheck className="h-7 w-7 text-primary-400" />
          <span className="font-bold tracking-tight">QMS Platform</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-700 text-white'
                    : 'text-primary-300 hover:bg-primary-800 hover:text-white',
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-primary-800 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-700">
              <User className="h-4 w-4 text-primary-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? user?.email}</p>
              <p className="truncate text-xs text-primary-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 transition-colors hover:bg-primary-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
