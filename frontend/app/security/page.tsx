import { SiteHeader } from "@/components/SiteHeader";

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-surface-muted">
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
        <h1 className="font-display text-4xl font-bold text-ink-950">Security & privacy</h1>
        <div className="admin-card mt-6 space-y-4 p-6 text-ink-600">
          <p>
            Resumes and employment histories are sensitive personal information. HireMatch AI enforces
            authentication, RBAC, and tenant isolation in the API.
          </p>
          <p>
            AI assessments are decision-support tools. The product must not automatically reject or hire
            candidates, and must not rank using protected characteristics.
          </p>
          <p>
            Email delivery, payment providers, and object storage require real credentials before production use.
          </p>
        </div>
      </section>
    </main>
  );
}
