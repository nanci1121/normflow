import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ShieldCheck, LayoutDashboard, FileText, LogOut, User, Menu, X, Users, ListChecks, Moon, Sun, Languages } from 'lucide-react'
import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/documents', icon: FileText, key: 'documents' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'es' : 'en'
    i18n.changeLanguage(next)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-primary-950 text-white transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 border-b border-primary-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary-400" />
            <span className="font-bold tracking-tight">QMS Platform</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-primary-300 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'text-primary-300 hover:bg-primary-800 hover:text-white',
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <NavLink
                to="/admin/users"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'text-primary-300 hover:bg-primary-800 hover:text-white',
                  )
                }
              >
                <Users className="h-5 w-5 shrink-0" />
                {t('nav.users')}
              </NavLink>
              <NavLink
                to="/admin/approval-workflows"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'text-primary-300 hover:bg-primary-800 hover:text-white',
                  )
                }
              >
                <ListChecks className="h-5 w-5 shrink-0" />
                {t('nav.workflows')}
              </NavLink>
            </>
          )}
        </nav>

        {/* User + logout */}
        <div className="border-t border-primary-800 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-700 shadow-inner">
              <User className="h-4 w-4 text-primary-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name ?? user?.email}</p>
              <p className="truncate text-xs text-primary-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 transition-all duration-200 hover:bg-primary-800 hover:text-white"
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {t(`nav.theme.${theme === 'dark' ? 'light' : 'dark'}`)}
          </button>
          <button
            onClick={toggleLanguage}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 transition-all duration-200 hover:bg-primary-800 hover:text-white"
            aria-label={i18n.language === 'en' ? 'Cambiar a español' : 'Switch to English'}
          >
            <Languages className="h-4 w-4" />
            {t(`nav.language.${i18n.language === 'en' ? 'es' : 'en'}`)}
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 transition-all duration-200 hover:bg-red-600/20 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-auto">
        {/* Mobile header */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ShieldCheck className="h-5 w-5 text-primary-600" />
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">QMS Platform</span>
        </div>

        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
