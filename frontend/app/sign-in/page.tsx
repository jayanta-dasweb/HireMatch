"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { ButtonLoader, FullPageLoader } from "@/components/Loading";
import { loginUser } from "@/lib/api";
import { clearUserCache } from "@/lib/useCurrentUser";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      clearUserCache();
      await loginUser({ email, password });
      setBooting(true);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  if (booting) {
    return <FullPageLoader label="Opening your workspace…" />;
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard title="Sign in" subtitle="Sign in with your HireMatch account.">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorText message={error} />
          <PrimaryButton type="submit" disabled={loading} className="inline-flex gap-2">
            {loading && <ButtonLoader />}
            {loading ? "Signing in…" : "Sign in"}
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
