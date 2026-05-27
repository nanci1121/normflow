import { useQuery } from '@tanstack/react-query'
import { FileText, CheckCircle, Clock, Archive, Activity } from 'lucide-react'
import { getOverview } from '@/api/documents'
import type { AuditEvent } from '@/types'

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof FileText; color: string; iconColor: string }
> = {
  draft:     { label: 'Borrador',    icon: FileText,    color: 'bg-gray-100',   iconColor: 'text-gray-500' },
  in_review: { label: 'En revisión', icon: Clock,       color: 'bg-amber-50',   iconColor: 'text-amber-600' },
  approved:  { label: 'Aprobado',    icon: CheckCircle, color: 'bg-green-50',   iconColor: 'text-green-600' },
  obsolete:  { label: 'Obsoleto',    icon: Archive,     color: 'bg-red-50',     iconColor: 'text-red-500' },
}

const ACTION_LABELS: Record<string, string> = {
  'document.created':       'Documento creado',
  'document.submitted':     'Enviado a revisión',
  'document.approved':      'Aprobado',
  'document.rejected':      'Rechazado',
  'document.obsoleted':     'Marcado como obsoleto',
  'document.version_added': 'Nueva versión añadida',
  'document.signed':        'Firmado electrónicamente',
}

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function AuditRow({ event }: { event: AuditEvent }) {
  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
        <Activity className="h-4 w-4 text-primary-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">
          {ACTION_LABELS[event.action] ?? event.action}
        </p>
        <p className="text-xs text-gray-500">
          Actor: <span className="font-mono">{event.actorId}</span>
          {' · '}
          Doc: <span className="font-mono">{event.entityId.slice(0, 8)}…</span>
        </p>
      </div>
      <span className="shrink-0 text-xs text-gray-400">{timeAgo(event.timestamp)}</span>
    </li>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['overview'],
    queryFn: getOverview,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        Error al cargar el resumen. Verifica que el servidor está en marcha.
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel de control</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resumen del sistema de gestión documental
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total */}
        <div className="col-span-2 sm:col-span-1 rounded-xl bg-primary-600 p-5 text-white shadow-sm">
          <p className="text-sm font-medium text-primary-200">Total documentos</p>
          <p className="mt-1 text-4xl font-bold">{data?.documentsTotal ?? 0}</p>
        </div>

        {/* By status */}
        {(['draft', 'in_review', 'approved', 'obsolete'] as const).map((status) => {
          const cfg = STATUS_CONFIG[status]
          const Icon = cfg.icon
          return (
            <div key={status} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <div className={`mb-2 inline-flex rounded-lg p-2 ${cfg.color}`}>
                <Icon className={`h-4 w-4 ${cfg.iconColor}`} />
              </div>
              <p className="text-xs text-gray-500">{cfg.label}</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.byStatus[status] ?? 0}
              </p>
            </div>
          )
        })}
      </div>

      {/* Recent audit events */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
          <Activity className="h-4 w-4 text-primary-600" />
          <h2 className="font-semibold text-gray-900">Actividad reciente</h2>
        </div>
        <ul className="divide-y divide-gray-50">
          {data?.recentAuditEvents.length === 0 ? (
            <li className="px-6 py-10 text-center text-sm text-gray-400">
              Sin actividad reciente
            </li>
          ) : (
            data?.recentAuditEvents.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
