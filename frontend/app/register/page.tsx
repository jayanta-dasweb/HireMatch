"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthCard, ErrorText, Field, PageShell, PrimaryButton } from "@/components/ui";
import { ButtonLoader, FullPageLoader } from "@/components/Loading";
import { useToast } from "@/components/Toast";
import { loginUser, registerUser } from "@/lib/api";
import { friendlyErrorMessage, isValidEmailFormat } from "@/lib/errors";
import { clearUserCache } from "@/lib/useCurrentUser";

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      const msg = "Please enter your full name.";
      setError(msg);
      toast.warning(msg);
      return;
    }
    if (!isValidEmailFormat(email)) {
      const msg = "Please enter a valid email address (example: name@company.com)";
      setError(msg);
      toast.warning(msg, "Invalid email");
      return;
    }
    if (password.length < 8) {
      const msg = "Password must be at least 8 characters.";
      setError(msg);
      toast.warning(msg, "Invalid password");
      return;
    }

    setLoading(true);
    try {
      clearUserCache();
      await registerUser({ email: email.trim(), password, full_name: fullName.trim() });
      await loginUser({ email: email.trim(), password });
      toast.success("Your workspace is ready.", "Account created");
      setBooting(true);
      router.push("/dashboard");
    } catch (err) {
      const msg = friendlyErrorMessage(err, "Registration failed");
      setError(msg);
      toast.error(msg, "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return <FullPageLoader label="Opening your workspace…" />;
  }

  return (
    <PageShell>
      <SiteHeader />
      <AuthCard title="Create account" subtitle="Create your HireMatch workspace.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Field
            label="Email"
            type="email"
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
            {loading ? "Creating…" : "Create account"}
          </PrimaryButton>
        </form>
        <p className="text-center text-sm text-ink-500">
          Already registered?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-700">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </PageShell>
  );
}
