import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search, FilterX, CheckCircle } from 'lucide-react'
import { listDocuments } from '@/api/documents'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import type { ApprovalProgress as ApprovalProgressType, DocumentApproval, DocumentStatus, DocumentCircuitInfo } from '@/types'

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function CircuitBadge({ circuit }: { circuit?: DocumentCircuitInfo }) {
  if (!circuit) return <span className="text-xs text-gray-400">Sin circuito</span>
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-primary-200/50">
      {circuit.category}
      <span className="text-primary-400">·</span>
      {circuit.steps.length} paso{circuit.steps.length !== 1 ? 's' : ''}
    </span>
  )
}

function ApprovalProgress({
  status,
  progress,
  approvals,
  circuit,
}: {
  status: DocumentStatus
  progress: ApprovalProgressType
  approvals: DocumentApproval[]
  circuit?: DocumentCircuitInfo
}) {
  if (status === 'draft' && !circuit) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Sin flujo</span>
        <CircuitBadge circuit={circuit} />
      </div>
    )
  }

  if (status === 'obsolete' || progress.totalSteps === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          {status === 'obsolete' ? 'Obsoleto' : 'Completo'}
        </span>
        <CircuitBadge circuit={circuit} />
      </div>
    )
  }

  const allApproved = progress.approvedSteps === progress.totalSteps
  const stepInfo = approvals[0]?.stepOrder != null
    ? `Paso ${progress.approvedSteps + 1}/${progress.totalSteps}`
    : `${progress.approvedSteps}/${progress.totalSteps}`

  return (
    <div className="flex flex-col gap-1">
      {allApproved ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          Completo
        </span>
      ) : (
        <span className="text-xs text-amber-600 font-medium">{stepInfo}</span>
      )}
      <div className="flex gap-0.5">
        {approvals.map((a, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              a.status === 'approved' ? 'bg-green-500' : a.status === 'rejected' ? 'bg-red-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <CircuitBadge circuit={circuit} />
    </div>
  )
}

export function DocumentsListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['documents', search],
    queryFn: () => listDocuments(search || undefined),
  })

  const filtered = (data ?? []).filter((doc) => {
    if (statusFilter && doc.status !== statusFilter) return false
    if (categoryFilter && doc.category !== categoryFilter) return false
    return true
  })

  const categories = [...new Set(data?.map((d) => d.category) ?? [])].sort()
  const hasFilters = statusFilter || categoryFilter

  return (
    <div className="page-transition p-4 sm:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión documental del sistema QMS</p>
        </div>
        <Link to="/documents/new">
          <Button>
            <Plus className="h-4 w-4" />
            Nuevo documento
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, título, categoría..."
            className="input-default pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'draft', label: 'Borrador' },
            { value: 'in_review', label: 'En revisión' },
            { value: 'approved', label: 'Aprobado' },
            { value: 'obsolete', label: 'Obsoleto' },
          ]}
          placeholder="Todos los estados"
          className="min-w-[160px]"
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={categories.map((c) => ({ value: c, label: c }))}
          placeholder="Todas las categorías"
          className="min-w-[160px]"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter(''); setCategoryFilter('') }}
          >
            <FilterX className="h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : isError ? (
        <div className="card p-6 text-center" role="alert">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <FileText className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-red-600">
            Error al cargar documentos. Verifica que el servidor está en marcha.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-20 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">
            {search || hasFilters
              ? 'No se encontraron documentos con los filtros actuales'
              : 'No hay documentos todavía'}
          </p>
          {!search && !hasFilters && (
            <Link to="/documents/new">
              <Button className="mt-4">
                <Plus className="h-4 w-4" />
                Crear primer documento
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-gray-200 animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 font-semibold text-gray-500">Código</th>
                  <th className="px-6 py-3 font-semibold text-gray-500">Título</th>
                  <th className="px-6 py-3 font-semibold text-gray-500">Categoría</th>
                  <th className="px-6 py-3 font-semibold text-gray-500">Estado</th>
                  <th className="px-6 py-3 font-semibold text-gray-500">Flujo</th>
                  <th className="px-6 py-3 font-semibold text-gray-500">Actualizado</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((doc, i) => (
                  <tr
                    key={doc.id}
                    className="transition-all duration-200 hover:bg-gray-50"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="px-6 py-4 font-mono text-xs font-medium text-gray-900">
                      {doc.code}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{doc.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.status as DocumentStatus} />
                    </td>
                    <td className="px-6 py-4">
                      <ApprovalProgress status={doc.status as DocumentStatus} progress={doc.approvalProgress} approvals={doc.approvals} circuit={doc.approvalCircuit} />
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-400">{timeAgo(doc.updatedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/documents/${doc.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-50 px-6 py-3 text-xs text-gray-400">
            {filtered.length} documento{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
