interface ComingSoonProps {
  feature?: string
  description?: string
}

export default function ComingSoon({ feature, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] py-16 gap-8 select-none">
      {/* Icon */}
      <div className="w-16 h-16 rounded-xl bg-surface-2 border border-hairline flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="#5e6ad2" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
          <path d="M16 4v24M4 10l12 6 12-6" stroke="#5e6ad2" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Copy */}
      <div className="text-center space-y-2 max-w-sm px-4">
        <h2 className="text-sm font-semibold text-ink" style={{ letterSpacing: '-0.2px' }}>Coming soon</h2>
        {feature ? (
          <p className="text-xs text-ink-subtle">
            <span className="font-medium text-ink-muted">{feature}</span> is currently in development.
          </p>
        ) : (
          <p className="text-xs text-ink-subtle">This feature is currently in development.</p>
        )}
        {description && (
          <p className="text-xs text-ink-tertiary leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}
