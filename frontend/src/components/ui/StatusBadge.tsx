import { FileText, Clock, CheckCircle, Archive } from 'lucide-react'
import type { DocumentStatus } from '@/types'

const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',    className: 'status-badge-draft' },
  in_review: { label: 'En revisión', className: 'status-badge-review' },
  approved:  { label: 'Aprobado',    className: 'status-badge-approved' },
  obsolete:  { label: 'Obsoleto',    className: 'status-badge-obsolete' },
}

const STATUS_ICONS: Record<DocumentStatus, typeof FileText> = {
  draft:     FileText,
  in_review: Clock,
  approved:  CheckCircle,
  obsolete:  Archive,
}

interface StatusBadgeProps {
  status: DocumentStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status]
  const Icon = STATUS_ICONS[status]
  const iconSize = size === 'sm' ? 12 : 14

  return (
    <span className={`${cfg.className} ${size === 'md' ? 'px-3 py-1.5 text-sm' : ''}`}>
      <Icon size={iconSize} />
      {cfg.label}
    </span>
  )
}
