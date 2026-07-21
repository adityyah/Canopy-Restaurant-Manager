// frontend/src/components/LoadingSpinner.tsx
// Typing-dots animation used in the chat interface and during API loading states.
// Per DESIGN.md: loading feedback uses the warning-yellow / accent-green palette.

interface Props {
  size?: 'sm' | 'md' | 'lg'
  /** Override message. Defaults to nothing (just the dots). */
  label?: string
}

const DOT_SIZES = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
}

export default function LoadingSpinner({ size = 'md', label }: Props) {
  const dotClass = DOT_SIZES[size]
  return (
    <div className="flex items-center gap-2" role="status" aria-label={label ?? 'Loading'}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${dotClass} rounded-full bg-accent-green animate-dot-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
      {label && <span className="text-text-muted text-xs">{label}</span>}
    </div>
  )
}
