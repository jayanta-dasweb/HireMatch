"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, logoutUser, UserMe } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => {
        setError("Please sign in again.");
        router.replace("/sign-in");
      });
  }, [router]);

  async function onLogout() {
    await logoutUser();
    router.push("/");
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-ink-700">{error || "Loading workspace…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 animate-rise">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-4xl text-ink-950">Welcome, {user.full_name}</p>
          <p className="mt-2 text-ink-700">
            Phase 1 foundation is live. Resume intelligence arrives in Phase 2.
          </p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-md border border-ink-800/15 bg-white/80 px-3 py-2 text-sm font-medium"
        >
          Log out
        </button>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/80 p-6 shadow-soft backdrop-blur">
          <h2 className="font-display text-2xl">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-700">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-700">Verified</dt>
              <dd className="font-medium">{user.is_email_verified ? "Yes" : "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-700">Locale</dt>
              <dd className="font-medium">{user.locale}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl bg-white/80 p-6 shadow-soft backdrop-blur">
          <h2 className="font-display text-2xl">Workspaces</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {user.memberships.map((m) => (
              <li
                key={m.organization_id}
                className="flex items-center justify-between rounded-md border border-ink-800/10 px-3 py-2"
              >
                <span>
                  <span className="font-medium">{m.organization_name}</span>
                  <span className="ml-2 text-ink-700">({m.role})</span>
                </span>
                {m.is_personal && (
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                    personal
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-8 text-sm text-ink-700">
        Next:{" "}
        <Link href="/" className="font-semibold text-accent-strong">
          Phase 2 resume upload & parsing
        </Link>{" "}
        after this foundation is reviewed.
      </p>
    </main>
  );
}
