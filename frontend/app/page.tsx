import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface-muted">
      <SiteHeader />
      <section className="relative mx-auto grid min-h-[78vh] w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-fade-up space-y-6">
          <p className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
            Career + recruitment SaaS
          </p>
          <h1 className="font-display text-5xl font-bold leading-tight text-ink-950 md:text-6xl">
            HireMatch <span className="text-brand-600">AI</span>
          </h1>
          <p className="max-w-xl text-lg text-ink-600">
            Evidence-backed resume matching for candidates and agencies — clear scores,
            skill gaps, and human-reviewed decisions.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/register" className="btn-primary px-5 py-3">
              Start free
            </Link>
            <Link href="/sign-in" className="btn-ghost px-5 py-3">
              Open admin console
            </Link>
          </div>
        </div>

        <div className="admin-card animate-fade-up overflow-hidden p-0 shadow-float">
          <div className="border-b border-ink-100 bg-ink-950 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-200">Admin preview</p>
            <p className="mt-1 font-display text-xl font-bold">TailAdmin-style console</p>
          </div>
          <div className="grid gap-3 bg-surface-muted p-5 sm:grid-cols-2">
            {[
              ["Workspaces", "Secure tenants"],
              ["Matching", "Phase 2+"],
              ["Pipelines", "Agency ready"],
              ["Billing", "Phase 6"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-ink-100 bg-white p-4">
                <p className="text-sm font-semibold text-ink-900">{title}</p>
                <p className="mt-1 text-xs text-ink-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
