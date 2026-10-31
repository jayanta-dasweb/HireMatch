"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { acceptOrganizationInvite, loginUser } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { clearActiveOrg } from "@/lib/orgContext";
import { clearUserCache } from "@/lib/useCurrentUser";

function hasSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!localStorage.getItem("hirematch_tokens");
  } catch {
    return false;
  }
}

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const orgId = params.get("org") || "";
  const tokenFromUrl = params.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(hasSession());
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!orgId || !token.trim()) {
      setError("Invite link is missing organization or token.");
      return;
    }
    setBusy(true);
    try {
      if (!hasSession()) {
        if (!email.trim() || !password) {
          setError("Sign in with the invited email to join this organization.");
          setBusy(false);
          return;
        }
        await loginUser({ email: email.trim(), password });
        setSignedIn(true);
      }
      await acceptOrganizationInvite(orgId, token.trim());
      clearUserCache();
      clearActiveOrg();
      try {
        localStorage.setItem("hirematch_active_org", orgId);
      } catch {
        /* ignore */
      }
      router.replace("/dashboard/team");
    } catch (err) {
      setError(friendlyErrorMessage(err, "Could not accept invitation"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard
        title="Join organization"
        subtitle="Accept your HireMatch workspace invite. One account can belong to many organizations."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <ErrorText message={error} />
          {!orgId && (
            <p className="text-sm text-rose-700">This invite link is incomplete. Ask your admin to resend it.</p>
          )}
          {!signedIn && (
            <>
              <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          {signedIn && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
              You are signed in. Accept to join this organization.
            </p>
          )}
          {!tokenFromUrl && (
            <Field
              label="Invite token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste invite token"
            />
          )}
          <PrimaryButton type="submit" disabled={busy || !orgId}>
            {busy ? "Joining…" : "Accept invite"}
          </PrimaryButton>
          <p className="text-center text-sm text-ink-500">
            No account yet?{" "}
            <Link href="/register" className="font-semibold text-brand-700">
              Register
            </Link>{" "}
            first, then return to this link.
          </p>
        </form>
      </AuthCard>
    </PageShell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-ink-500">Loading invite…</div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
