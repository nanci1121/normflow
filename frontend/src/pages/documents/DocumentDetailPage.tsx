import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  Send,
  XCircle,
  Signature,
  Trash2,
  Activity,
  History,
  Users,
  FileSignature,
  GitBranch,
  Check,
  X,
} from 'lucide-react'
import { getDocument, submitDocument, resolveApproval, signDocument, obsoleteDocument, getDocumentAudit } from '@/api/documents'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/LoadingSkeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import type { DocumentDetail, DocumentStatus, DocumentVersion, DocumentCircuitInfo, DocumentApproval } from '@/types'

type Tab = 'info' | 'versions' | 'approvals' | 'signatures' | 'audit'

const ACTION_LABELS: Record<string, string> = {
  'document.created':       'Documento creado',
  'document.submitted':     'Enviado a revisión',
  'document.approved':      'Aprobado',
  'document.rejected':      'Rechazado',
  'document.obsoleted':     'Marcado como obsoleto',
  'document.version_added': 'Nueva versión añadida',
  'document.signed':        'Firmado electrónicamente',
}

const STATUS_TRANSITION_LABELS: Record<string, { from: string; to: string }> = {
  'document.created':       { from: '—', to: 'Borrador' },
  'document.submitted':     { from: 'Borrador', to: 'En revisión' },
  'document.approved':      { from: 'En revisión', to: 'Aprobado' },
  'document.rejected':      { from: 'En revisión', to: 'Borrador' },
  'document.obsoleted':     { from: 'Aprobado', to: 'Obsoleto' },
}

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function InfoTab({ doc }: { doc: DocumentDetail }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Metadatos</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Código</dt>
            <dd className="font-mono text-sm font-medium text-gray-900">{doc.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Categoría</dt>
            <dd className="text-sm text-gray-900">{doc.category}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Visibilidad</dt>
            <dd className="text-sm text-gray-900 capitalize">{doc.visibility}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Propietario</dt>
            <dd className="font-mono text-sm text-gray-900">{doc.ownerId.slice(0, 12)}…</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Creado</dt>
            <dd className="text-sm text-gray-900">{formatDate(doc.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Actualizado</dt>
            <dd className="text-sm text-gray-900">{formatDate(doc.updatedAt)}</dd>
          </div>
          {doc.obsoleteReason && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-500">Motivo de obsolecencia</dt>
              <dd className="text-sm text-gray-900">{doc.obsoleteReason}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Tags</h3>
        {doc.standardTags.length === 0 ? (
          <p className="text-sm text-gray-400">Sin etiquetas</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {doc.standardTags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 ring-1 ring-primary-200/50">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Versión actual</h3>
        {(() => {
          const v = doc.versions[0]
          if (!v) return <p className="text-sm text-gray-400">Sin versión</p>
          return (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                  v{v.number}
                </span>
                <span className="text-xs text-gray-400">{formatDate(v.createdAt)}</span>
              </div>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-900">
                {v.content}
              </div>
            </div>
          )
        })()}
      </Card>
    </div>
  )
}

function VersionsTab({ versions }: { versions: DocumentVersion[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <Card className="animate-fade-in" padding={false}>
      {versions.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Sin versiones</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-gray-50"
                aria-expanded={expandedId === v.id}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    v{v.number}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{v.title}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(v.createdAt)} · {v.changeSummary}
                    </p>
                  </div>
                </div>
                <History className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${expandedId === v.id ? 'rotate-180' : ''}`} />
              </button>
              {expandedId === v.id && (
                <div className="animate-slide-up border-t border-gray-50 px-6 py-4">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-900">
                    {v.content}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CircuitSection({ circuit, approvals }: { circuit?: DocumentCircuitInfo; approvals: DocumentApproval[] }) {
  if (!circuit) return null

  const approvalByApproverId = new Map(approvals.map((a) => [a.approverId, a]))

  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <GitBranch className="h-4 w-4 text-primary-600" />
        Circuito de aprobación: {circuit.category}
      </h3>
      <div className="space-y-3">
        {circuit.steps.map((step, idx) => {
          const approval = approvalByApproverId.get(step.approverId)
          const isActive = approval?.status === 'pending'
          const isDone = approval?.status === 'approved'
          const isRejected = approval?.status === 'rejected'
          return (
            <div key={step.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                      : isRejected
                        ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                        : isActive
                          ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                          : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : isRejected ? <X className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < circuit.steps.length - 1 && (
                  <div className="mt-1 h-6 w-px bg-gray-200" />
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{step.approverName}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isDone
                      ? 'bg-green-100 text-green-700'
                      : isRejected
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isDone ? 'Aprobado' : isRejected ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{step.responsibility}</p>
                {approval?.comment && (
                  <p className="mt-1 text-xs text-gray-400 italic">"{approval.comment}"</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ApprovalsTab({ doc }: { doc: DocumentDetail }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [comment, setComment] = useState('')
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null)

  const circuit = doc.approvalCircuit

  const submitMutation = useMutation({
    mutationFn: () => {
      const approverIds = circuit
        ? circuit.steps.map((s) => s.approverId)
        : []
      return submitDocument(doc.id, user!.id, approverIds)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] })
      showToast('success', 'Documento enviado a revisión correctamente')
    },
    onError: () => {
      showToast('error', 'Error al enviar el documento a revisión')
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      resolveApproval(doc.id, user!.id, decision, comment || undefined),
    onSuccess: () => {
      setComment('')
      setConfirmAction(null)
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] })
      showToast('success', 'Decisión registrada correctamente')
    },
    onError: () => {
      setConfirmAction(null)
      showToast('error', 'Error al registrar la decisión')
    },
  })

  const pendingApprovals = doc.approvals.filter((a) => a.status === 'pending')
  const myPendingApproval = pendingApprovals.find((a) => a.approverId === user!.id)

  return (
    <div className="space-y-6 animate-fade-in">
      <CircuitSection circuit={circuit as DocumentCircuitInfo | undefined} approvals={doc.approvals} />

      {doc.status === 'draft' && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Send className="h-4 w-4" />
            Enviar a revisión
          </h3>
          {circuit ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                El documento se enviará con el circuito <strong>{circuit.category}</strong> ({circuit.steps.length} paso{circuit.steps.length !== 1 ? 's' : ''}):
              </p>
              <ul className="space-y-1.5">
                {circuit.steps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
                      {step.stepOrder}
                    </span>
                    <span className="font-medium">{step.approverName}</span>
                    <span className="text-xs text-gray-400">— {step.responsibility}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => submitMutation.mutate()}
                isLoading={submitMutation.isPending}
              >
                <Send className="h-4 w-4" />
                Enviar a revisión
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-600">
                No hay circuito configurado para la categoría "{doc.category}".
                Configúralo en Administración &gt; Circuitos de aprobación o añade aprobadores manualmente.
              </p>
              <p className="text-xs text-gray-400">
                El backend usará el circuito automáticamente si existe.
              </p>
              <Button
                onClick={() => submitMutation.mutate()}
                isLoading={submitMutation.isPending}
              >
                <Send className="h-4 w-4" />
                Enviar a revisión
              </Button>
            </div>
          )}
        </Card>
      )}

      {doc.status === 'in_review' && myPendingApproval && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CheckCircle className="h-4 w-4 text-green-600" />
            Tu decisión
          </h3>
          {myPendingApproval.responsibility && (
            <p className="mb-3 text-xs text-gray-500">
              Responsabilidad: {myPendingApproval.responsibility}
            </p>
          )}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario (opcional)"
            rows={2}
            aria-label="Comentario de aprobación"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={() => setConfirmAction('approve')}
            >
              <CheckCircle className="h-4 w-4" />
              Aprobar
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmAction('reject')}
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <CardHeader
          title="Historial de aprobaciones"
          icon={<Users className="h-4 w-4" />}
        />
        {doc.approvals.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            No se ha solicitado ninguna aprobación todavía
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {doc.approvals.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50">
                <div>
                  <p className="text-sm text-gray-900">{a.approverId}</p>
                  {a.responsibility && <p className="text-xs text-gray-500">{a.responsibility}</p>}
                  {a.comment && <p className="text-xs text-gray-500 italic">{a.comment}</p>}
                  {a.decidedAt && (
                    <p className="text-xs text-gray-400">{formatDate(a.decidedAt)}</p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  a.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : a.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}>
                  {a.status === 'approved'
                    ? 'Aprobado'
                    : a.status === 'rejected'
                      ? 'Rechazado'
                      : 'Pendiente'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirmAction === 'approve'}
        title="Aprobar documento"
        message="¿Estás seguro de que quieres aprobar este documento? Esta acción no se puede deshacer."
        confirmLabel="Aprobar"
        confirmVariant="primary"
        isLoading={resolveMutation.isPending}
        onConfirm={() => resolveMutation.mutate('approved')}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'reject'}
        title="Rechazar documento"
        message="¿Estás seguro de que quieres rechazar este documento? Volverá a estado borrador."
        confirmLabel="Rechazar"
        confirmVariant="danger"
        isLoading={resolveMutation.isPending}
        onConfirm={() => resolveMutation.mutate('rejected')}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function SignaturesTab({ doc }: { doc: DocumentDetail }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [signatureValue, setSignatureValue] = useState('')

  const signMutation = useMutation({
    mutationFn: () => signDocument(doc.id, user!.id, signatureValue),
    onSuccess: () => {
      setSignatureValue('')
      queryClient.invalidateQueries({ queryKey: ['document', doc.id] })
      showToast('success', 'Documento firmado correctamente')
    },
    onError: () => {
      showToast('error', 'Error al firmar el documento')
    },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {doc.status === 'approved' && (
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileSignature className="h-4 w-4" />
            Firmar documento
          </h3>
          <div className="flex items-end gap-3">
            <Input
              label="Firma electrónica"
              value={signatureValue}
              onChange={(e) => setSignatureValue(e.target.value)}
              placeholder="Tu nombre o identificador de firma"
            />
            <Button
              onClick={() => signMutation.mutate()}
              isLoading={signMutation.isPending}
              disabled={!signatureValue.trim()}
            >
              <Signature className="h-4 w-4" />
              Firmar
            </Button>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <CardHeader
          title={`Firmas (${doc.signatures.length})`}
          icon={<Signature className="h-4 w-4" />}
        />
        {doc.signatures.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">Sin firmas</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {doc.signatures.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-4 font-mono text-sm text-gray-900">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs text-primary-600">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function AuditTab({ doc }: { doc: DocumentDetail }) {
  const { data: events } = useQuery({
    queryKey: ['audit', doc.id],
    queryFn: () => getDocumentAudit(doc.id),
  })

  return (
    <Card padding={false} className="animate-fade-in">
      <CardHeader
        title="Auditoría — Historial de cambios de estado"
        icon={<Activity className="h-4 w-4" />}
      />
      {!events || events.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">Sin eventos de auditoría</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {events.map((event) => {
            const transition = STATUS_TRANSITION_LABELS[event.action]
            return (
              <li key={event.id} className="px-6 py-4 transition-colors hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                        event.action === 'document.approved' ? 'bg-green-100 text-green-700 ring-green-300' :
                        event.action === 'document.rejected' ? 'bg-red-100 text-red-700 ring-red-300' :
                        event.action === 'document.obsoleted' ? 'bg-gray-100 text-gray-600 ring-gray-300' :
                        event.action === 'document.submitted' ? 'bg-amber-100 text-amber-700 ring-amber-300' :
                        'bg-primary-50 text-primary-700 ring-primary-200'
                      }`}>
                        {event.action === 'document.created' ? 1 :
                         event.action === 'document.submitted' ? 2 :
                         event.action === 'document.approved' ? 3 :
                         event.action === 'document.rejected' ? '↩' :
                         event.action === 'document.obsoleted' ? 4 : '*'}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </p>
                      {transition && (
                        <p className="text-xs text-gray-500">
                          {transition.from} → {transition.to}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        Actor: <span className="font-mono">{event.actorId.slice(0, 12)}…</span>
                      </p>
                      {event.details && (
                        <pre className="mt-1 overflow-x-auto text-xs text-gray-400 bg-gray-50 rounded p-2">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [obsoleteReason, setObsoleteReason] = useState('')
  const [showObsoleteConfirm, setShowObsoleteConfirm] = useState(false)

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id!),
    enabled: !!id,
  })

  const obsoleteMutation = useMutation({
    mutationFn: () => obsoleteDocument(doc!.id, user!.id, obsoleteReason),
    onSuccess: () => {
      setObsoleteReason('')
      setShowObsoleteConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['document', doc!.id] })
      showToast('success', 'Documento marcado como obsoleto')
    },
    onError: () => {
      setShowObsoleteConfirm(false)
      showToast('error', 'Error al marcar documento como obsoleto')
    },
  })

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'info',       label: 'Información',   icon: FileText },
    { key: 'versions',   label: 'Versiones',     icon: History },
    { key: 'approvals',  label: 'Aprobaciones',  icon: Users },
    { key: 'signatures', label: 'Firmas',        icon: Signature },
    { key: 'audit',      label: 'Auditoría',     icon: Activity },
  ]

  if (isLoading) {
    return (
      <div className="page-transition p-8">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-8 h-4 w-48" />
        <div className="mb-6 flex gap-6">
          {tabs.map((t) => (
            <Skeleton key={t.key} className="h-10 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="card p-8 text-center animate-scale-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <FileText className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-sm text-red-600">Documento no encontrado</p>
          <Button variant="outline" onClick={() => navigate('/documents')} className="mt-4">
            Volver a documentos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-transition p-4 sm:p-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/documents')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a documentos
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
              <StatusBadge status={doc.status as DocumentStatus} size="md" />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              <span className="font-mono">{doc.code}</span> · {doc.category}
            </p>
          </div>

          {doc.status === 'approved' && (
            <div className="flex shrink-0 items-start gap-2">
              <Input
                value={obsoleteReason}
                onChange={(e) => setObsoleteReason(e.target.value)}
                placeholder="Motivo de obsolecencia"
                className="w-56 sm:w-64"
                aria-label="Motivo de obsolecencia"
              />
              <Button
                variant="danger"
                onClick={() => setShowObsoleteConfirm(true)}
                disabled={!obsoleteReason.trim()}
              >
                <Trash2 className="h-4 w-4" />
                Obsolecer
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto scrollbar-thin" role="tablist">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              role="tab"
              aria-selected={activeTab === key}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-all duration-200 ${
                activeTab === key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'info' && <InfoTab doc={doc} />}
      {activeTab === 'versions' && <VersionsTab versions={doc.versions} />}
      {activeTab === 'approvals' && <ApprovalsTab doc={doc} />}
      {activeTab === 'signatures' && <SignaturesTab doc={doc} />}
      {activeTab === 'audit' && <AuditTab doc={doc} />}

      <ConfirmDialog
        open={showObsoleteConfirm}
        title="Marcar documento como obsoleto"
        message="¿Estás seguro de que quieres marcar este documento como obsoleto? Esta acción no se puede deshacer."
        confirmLabel="Sí, marcar como obsoleto"
        confirmVariant="danger"
        isLoading={obsoleteMutation.isPending}
        onConfirm={() => obsoleteMutation.mutate()}
        onCancel={() => setShowObsoleteConfirm(false)}
      />
    </div>
  )
}
