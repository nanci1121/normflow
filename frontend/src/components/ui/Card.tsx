import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: boolean
}

export function Card({ children, className, hover = false, padding = true }: CardProps) {
  return (
    <div className={clsx(hover ? 'card-hover' : 'card', padding && 'p-6', className)}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export function CardHeader({ title, icon, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between border-b border-gray-100 px-6 py-4', className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        {icon}
        {title}
      </h3>
      {action}
    </div>
  )
}
