import { cn } from '@hysp/ui-kit'

interface NativeSelectProps {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function NativeSelect({ value, onChange, children, className }: NativeSelectProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </select>
  )
}
