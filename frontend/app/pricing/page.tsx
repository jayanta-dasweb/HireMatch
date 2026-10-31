import { SiteHeader } from "@/components/SiteHeader";

const plans = [
  { name: "Free", price: "₹0", note: "Limited analyses for evaluation" },
  { name: "Candidate Pro", price: "₹299–₹599/mo", note: "Job seekers — illustrative" },
  { name: "Recruiter", price: "₹1,999–₹3,999/mo", note: "Small teams — illustrative" },
  { name: "Agency", price: "₹5,000–₹15,000/mo", note: "Multi-seat agencies — illustrative" },
];

export default function PricingPage() {
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-6 py-12 animate-rise">
        <h1 className="font-display text-5xl text-ink-950">Pricing</h1>
        <p className="mt-3 max-w-2xl text-ink-700">
          Illustrative India launch ranges for market testing—not final pricing.
          Billing enforcement ships in Phase 6.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <article key={p.name} className="rounded-2xl bg-white/80 p-6 shadow-soft backdrop-blur">
              <h2 className="font-display text-2xl">{p.name}</h2>
              <p className="mt-2 text-xl font-semibold text-accent-strong">{p.price}</p>
              <p className="mt-2 text-sm text-ink-700">{p.note}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
