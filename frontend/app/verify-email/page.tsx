"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { verifyEmail } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [message, setMessage] = useState("Verifying…");

  useEffect(() => {
    if (!token) {
      setMessage("Missing verification token.");
      return;
    }
    verifyEmail(token)
      .then((r) => setMessage(r.message))
      .catch((e) => setMessage(e instanceof Error ? e.message : "Verification failed"));
  }, [token]);

  return (
    <section className="mx-auto max-w-lg px-6 py-12 animate-rise">
      <h1 className="font-display text-4xl">Email verification</h1>
      <p className="mt-4 text-ink-700">{message}</p>
      <Link href="/sign-in" className="mt-6 inline-block font-semibold text-accent-strong">
        Continue to sign in
      </Link>
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <main>
      <SiteHeader />
      <Suspense fallback={<p className="p-10">Loading…</p>}>
        <VerifyInner />
      </Suspense>
    </main>
  );
}
