import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('skeleton-pulse', className)} />
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-gray-200">
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
        <div className="flex gap-8">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 px-6 py-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-6">
      <Skeleton className="mb-4 h-5 w-32" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={clsx('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="mb-2 h-8 w-8 rounded-lg" />
      <Skeleton className="mb-1 h-3 w-16" />
      <Skeleton className="h-7 w-12" />
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="page-transition p-8">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Skeleton className="h-28 rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-8">
        <CardSkeleton lines={4} />
      </div>
    </div>
  )
}
