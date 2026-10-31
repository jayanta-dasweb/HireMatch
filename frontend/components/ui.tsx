import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const fieldClass =
  "mt-1 w-full rounded-md border border-ink-800/15 px-3 py-2 outline-none ring-accent focus:ring-2";

export function PageShell({ children }: { children: ReactNode }) {
  return <main>{children}</main>;
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-md px-6 py-10 animate-rise">
      <h1 className="font-display text-4xl text-ink-950">{title}</h1>
      <p className="mt-2 text-ink-700">{subtitle}</p>
      <div className="mt-8 space-y-4 rounded-2xl bg-white/80 p-6 shadow-soft backdrop-blur">
        {children}
      </div>
    </section>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className={fieldClass} {...props} />
    </label>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      {...props}
    >
      {children}
    </button>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-700">{message}</p>;
}
