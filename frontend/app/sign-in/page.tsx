"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { loginUser } from "@/lib/api";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginUser({ email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard title="Sign in" subtitle="Access your HireMatch AI admin workspace.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorText message={error} />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to console"}
          </PrimaryButton>
        </form>
        <p className="text-center text-sm text-ink-500">
          No account?{" "}
          <Link href="/register" className="font-semibold text-brand-700">
            Create one
          </Link>
        </p>
      </AuthCard>
    </PageShell>
  );
}
