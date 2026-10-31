export function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageLoader({ label = "Loading HireMatch…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 font-display text-sm font-bold text-white shadow-float">
        HM
      </div>
      <Spinner />
      <p className="text-sm font-medium text-ink-500">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink-100 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-muted lg:flex">
      <aside className="hidden w-72 bg-[var(--sidebar)] lg:block" />
      <div className="min-w-0 flex-1">
        <div className="flex h-16 items-center border-b border-ink-100 bg-white px-6">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-6 p-6 md:p-8">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-3 h-4 w-96 max-w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="admin-card p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-8 w-16" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="admin-card p-5">
                <Skeleton className="mb-4 h-5 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ButtonLoader() {
  return <Spinner className="h-4 w-4 border-white/40 border-t-white" />;
}
