import { SiteHeader } from "@/components/SiteHeader";

const plans = [
  { name: "Free", price: "₹0", note: "Limited analyses for evaluation" },
  { name: "Candidate Pro", price: "₹299–₹599/mo", note: "Job seekers — illustrative" },
  { name: "Recruiter", price: "₹1,999–₹3,999/mo", note: "Small teams — illustrative" },
  { name: "Agency", price: "₹5,000–₹15,000/mo", note: "Multi-seat agencies — illustrative" },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-surface-muted">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-12 animate-fade-up">
        <h1 className="font-display text-4xl font-bold text-ink-950">Pricing</h1>
        <p className="mt-3 max-w-2xl text-ink-500">
          Illustrative India launch ranges for market testing — not final pricing. Billing ships in Phase 6.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <article key={p.name} className="admin-card p-6">
              <h2 className="font-display text-xl font-bold text-ink-950">{p.name}</h2>
              <p className="mt-2 text-2xl font-semibold text-brand-700">{p.price}</p>
              <p className="mt-2 text-sm text-ink-500">{p.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
