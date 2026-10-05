export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink/60" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-velvet border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center" role="alert">
      <h3 className="text-lg font-semibold">That did not work</h3>
      <p className="mt-2 text-sm text-ink/70">{message}</p>
      {onRetry && <button type="button" className="btn-secondary mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-2 text-sm text-ink/70">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Metric({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs font-medium text-ink/60">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink/50">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
