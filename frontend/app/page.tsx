import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <section className="relative mx-auto grid min-h-[78vh] w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise space-y-6">
          <p className="font-display text-5xl leading-tight text-ink-950 md:text-6xl">
            HireMatch AI
          </p>
          <h1 className="max-w-xl text-2xl font-semibold text-ink-800 md:text-3xl">
            Evidence-backed job and resume matching for candidates and agencies.
          </h1>
          <p className="max-w-lg text-base text-ink-700">
            Semantic search, explainable scores, and skill-gap guidance—decision
            support for humans, never automated hiring verdicts.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/register"
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-strong"
            >
              Start free
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-ink-800/15 bg-white/70 px-5 py-3 text-sm font-semibold text-ink-800 backdrop-blur"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="animate-drift relative hidden overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-accent-strong via-accent to-ink-900 p-8 text-white shadow-soft lg:block">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,#fff_0,transparent_40%),radial-gradient(circle_at_80%_70%,#99f6e4_0,transparent_35%)]" />
          <div className="relative space-y-4">
            <p className="text-sm uppercase tracking-[0.2em] text-teal-100">Phase 1 live</p>
            <p className="font-display text-3xl">Secure multi-tenant foundation</p>
            <ul className="space-y-2 text-sm text-teal-50">
              <li>JWT auth with refresh rotation</li>
              <li>Organization workspaces & RBAC</li>
              <li>Tenant isolation enforced in the API</li>
              <li>Docker Compose for any Cursor clone</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
