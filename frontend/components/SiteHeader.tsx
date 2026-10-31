import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-display text-xs font-bold text-white">
            HM
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink-950">
            HireMatch <span className="text-brand-600">AI</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold text-ink-600 md:gap-3">
          <Link href="/pricing" className="hidden rounded-xl px-3 py-2 hover:bg-ink-50 sm:inline">
            Pricing
          </Link>
          <Link href="/security" className="hidden rounded-xl px-3 py-2 hover:bg-ink-50 sm:inline">
            Security
          </Link>
          <Link href="/sign-in" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
