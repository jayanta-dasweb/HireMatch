"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
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
      const result = await registerUser({
        email,
        password,
        full_name: fullName,
      });
      if (result.verification_token) {
        setDevToken(result.verification_token);
      }
      await loginUser({ email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-md px-6 py-10 animate-rise">
        <h1 className="font-display text-4xl text-ink-950">Create account</h1>
        <p className="mt-2 text-ink-700">
          Starts with a personal workspace. Agency features arrive in later phases.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl bg-white/80 p-6 shadow-soft backdrop-blur">
          <label className="block text-sm font-medium">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-800/15 px-3 py-2 outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-800/15 px-3 py-2 outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-800/15 px-3 py-2 outline-none ring-accent focus:ring-2"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {devToken && (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              Dev only: email backend is console. Verification token: {devToken}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-ink-700">
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-accent-strong">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
