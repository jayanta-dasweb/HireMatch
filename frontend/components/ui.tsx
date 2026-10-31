import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-surface-muted">{children}</main>;
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
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center px-6 py-10 animate-fade-up">
      <div className="w-full">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 font-display text-sm font-bold text-white shadow-float">
            HM
          </div>
          <h1 className="font-display text-3xl font-bold text-ink-950">{title}</h1>
          <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
        </div>
        <div className="admin-card space-y-4 p-6 md:p-7">{children}</div>
      </div>
    </section>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      {label}
      <input className="admin-input" {...props} />
    </label>
  );
}

export function PrimaryButton({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="btn-primary w-full" {...props}>
      {children}
    </button>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-rose-600">{message}</p>;
}
