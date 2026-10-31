"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { loginUser, registerUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await registerUser({ email, password, full_name: fullName });
      if (result.verification_token) setDevToken(result.verification_token);
      await loginUser({ email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard
        title="Create account"
        subtitle="Starts with a personal workspace. Agency features arrive later."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
          {devToken && (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              Dev only: verification token {devToken}
            </p>
          )}
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-sm text-ink-700">
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-accent-strong">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </PageShell>
  );
}
