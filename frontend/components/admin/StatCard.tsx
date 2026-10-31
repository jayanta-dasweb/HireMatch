import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "brand" | "blue" | "amber" | "rose";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <div className="admin-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-500">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-ink-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-card">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h2 className="font-display text-base font-bold text-ink-950">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
