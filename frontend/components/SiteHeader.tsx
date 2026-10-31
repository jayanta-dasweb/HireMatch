import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-display text-2xl tracking-tight text-ink-950">
        HireMatch <span className="text-accent">AI</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium text-ink-700">
        <Link href="/pricing" className="hover:text-accent-strong">
          Pricing
        </Link>
        <Link href="/security" className="hover:text-accent-strong">
          Security
        </Link>
        <Link href="/sign-in" className="rounded-md px-3 py-2 hover:bg-white/60">
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-accent px-3 py-2 text-white shadow-soft transition hover:bg-accent-strong"
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}
