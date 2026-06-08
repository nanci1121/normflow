import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { clsx } from 'clsx'

type ToastType = 'success' | 'error'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ring-1 backdrop-blur-sm animate-slide-up',
        toast.type === 'success'
          ? 'bg-green-50 text-green-800 ring-green-200'
          : 'bg-red-50 text-red-800 ring-red-200',
      )}
      role="alert"
    >
      {toast.type === 'success' ? (
        <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
      )}
      <p className="text-sm font-medium">{toast.message}</p>
      <button onClick={onClose} className="ml-auto shrink-0 rounded-md p-1 hover:bg-black/5 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
