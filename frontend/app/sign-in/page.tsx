"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, Field, PageShell, PrimaryButton } from "@/components/ui";
import { ButtonLoader, FullPageLoader } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { loginUser } from "@/lib/api";
import { friendlyErrorMessage, isValidEmailFormat } from "@/lib/errors";
import { clearUserCache } from "@/lib/useCurrentUser";

export default function SignInPage() {
  const router = useRouter();
  const alert = useAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(false);

    if (!isValidEmailFormat(email)) {
      const msg =
        email.toLowerCase().includes(".local")
          ? "Emails ending in .local are not allowed. Use admin@hirematch.ai"
          : "Please enter a valid email address (example: name@company.com)";
      setFieldError(true);
      alert.error(msg, "Invalid email");
      return;
    }
    if (password.length < 8) {
      const msg = "Password must be at least 8 characters.";
      setFieldError(true);
      alert.warning(msg, "Invalid password");
      return;
    }

    setLoading(true);
    try {
      clearUserCache();
      await loginUser({ email: email.trim(), password });
      alert.success("Welcome back. Opening your workspace.", "Signed in");
      setBooting(true);
      router.push("/dashboard");
    } catch (err) {
      const msg = friendlyErrorMessage(err, "Sign in failed");
      setFieldError(true);
      alert.error(msg, "Sign in failed");
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
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@hirematch.ai"
            error={fieldError}
            value={email}
            onChange={(e) => {
              setFieldError(false);
              setEmail(e.target.value);
            }}
          />
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            error={fieldError}
            value={password}
            onChange={(e) => {
              setFieldError(false);
              setPassword(e.target.value);
            }}
          />
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
