import { useQuery } from '@tanstack/react-query'
import { FileText, CheckCircle, Clock, Archive, Activity } from 'lucide-react'
import { getOverview } from '@/api/documents'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageSkeleton } from '@/components/ui/LoadingSkeleton'
import { Card, CardHeader } from '@/components/ui/Card'
import type { AuditEvent, DocumentStatus } from '@/types'

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
    <li className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-gray-50">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
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

const STATUS_ITEMS: { status: DocumentStatus; icon: typeof FileText; color: string; iconColor: string }[] = [
  { status: 'draft',     icon: FileText,    color: 'bg-gray-50',    iconColor: 'text-gray-500' },
  { status: 'in_review', icon: Clock,       color: 'bg-amber-50',   iconColor: 'text-amber-600' },
  { status: 'approved',  icon: CheckCircle, color: 'bg-green-50',   iconColor: 'text-green-600' },
  { status: 'obsolete',  icon: Archive,     color: 'bg-red-50',     iconColor: 'text-red-500' },
]

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['overview'],
    queryFn: getOverview,
    refetchInterval: 30_000,
  })

  if (isLoading) return <PageSkeleton />
  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="card p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <Activity className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-red-600">
            Error al cargar el resumen. Verifica que el servidor está en marcha.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-transition p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel de control</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resumen del sistema de gestión documental
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total - featured card */}
        <div className="col-span-2 sm:col-span-1 animate-scale-in rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 p-5 text-white shadow-md">
          <p className="text-sm font-medium text-primary-200">Total documentos</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{data?.documentsTotal ?? 0}</p>
        </div>

        {/* By status */}
        {STATUS_ITEMS.map(({ status, icon: Icon, color, iconColor }, i) => (
          <div
            key={status}
            className="card p-5 animate-scale-in"
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
          >
            <div className={`mb-3 inline-flex rounded-lg p-2.5 ${color} ring-1 ring-black/5`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <p className="text-xs text-gray-500">
              <StatusBadge status={status} />
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {data?.byStatus[status] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Recent audit events */}
      <Card className="animate-slide-up">
        <CardHeader
          title="Actividad reciente"
          icon={<Activity className="h-4 w-4 text-primary-600" />}
        />
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
      </Card>
    </div>
  )
}
