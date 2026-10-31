"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { ButtonLoader, FullPageLoader } from "@/components/Loading";
import { loginUser } from "@/lib/api";
import { clearUserCache } from "@/lib/useCurrentUser";

const ADMIN_EMAIL = "admin@hirematch.ai";
const ADMIN_PASSWORD = "Admin@123";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  async function signIn(nextEmail: string, nextPassword: string) {
    setLoading(true);
    setError(null);
    try {
      clearUserCache();
      await loginUser({ email: nextEmail, password: nextPassword });
      setBooting(true);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn(email, password);
  }

  if (booting) {
    return <FullPageLoader label="Opening admin console…" />;
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard title="Admin sign in" subtitle="Use the platform admin account to manage HireMatch.">
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
          <PrimaryButton type="submit" disabled={loading} className="inline-flex gap-2">
            {loading && <ButtonLoader />}
            {loading ? "Signing in…" : "Sign in as admin"}
          </PrimaryButton>
        </form>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setEmail(ADMIN_EMAIL);
            setPassword(ADMIN_PASSWORD);
            void signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
          }}
          className="btn-ghost w-full"
        >
          Fill platform admin login
        </button>

        <p className="rounded-xl bg-surface-muted p-3 text-center text-xs text-ink-500">
          Admin: <span className="font-semibold text-ink-700">{ADMIN_EMAIL}</span> /{" "}
          <span className="font-semibold text-ink-700">{ADMIN_PASSWORD}</span>
        </p>

        <p className="text-center text-sm text-ink-500">
          Need a normal account?{" "}
          <Link href="/register" className="font-semibold text-brand-700">
            Register
          </Link>
        </p>
      </AuthCard>
    </PageShell>
  );
}
