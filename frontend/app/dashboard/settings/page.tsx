"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { ButtonLoader, DashboardSkeleton } from "@/components/Loading";
import { apiFetch, UserMe } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function SettingsPage() {
  const { user, loading, setUser } = useCurrentUser();
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [locale, setLocale] = useState("en-IN");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setHeadline(user.headline || "");
    setLocale(user.locale);
  }, [user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await apiFetch<UserMe>(
        "/users/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            full_name: fullName,
            headline: headline || null,
            locale,
          }),
        },
        true,
      );
      setUser(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;

  return (
    <AdminShell
      title="Settings"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin={user.is_platform_admin}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Profile settings</h1>
        <p className="mt-1 text-sm text-ink-500">Update how your name appears across HireMatch.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Profile">
          <form onSubmit={onSave} className="space-y-4">
            <label className="block text-sm font-medium text-ink-700">
              Full name
              <input className="admin-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium text-ink-700">
              Headline
              <input
                className="admin-input"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Backend engineer"
              />
            </label>
            <label className="block text-sm font-medium text-ink-700">
              Locale
              <input className="admin-input" value={locale} onChange={(e) => setLocale(e.target.value)} />
            </label>
            {message && <p className="text-sm font-medium text-brand-700">{message}</p>}
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button type="submit" className="btn-primary inline-flex gap-2" disabled={saving}>
              {saving && <ButtonLoader />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Panel>

        <Panel title="Security">
          <ul className="space-y-3 text-sm text-ink-600">
            <li className="rounded-xl bg-surface-muted px-3 py-3">Password reset is available from the API / email flow.</li>
            <li className="rounded-xl bg-surface-muted px-3 py-3">Access tokens expire; refresh tokens rotate on use.</li>
            <li className="rounded-xl bg-surface-muted px-3 py-3">Tenant isolation is enforced on every organization route.</li>
          </ul>
        </Panel>

        <Panel title="Plan">
          <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-ink-900 p-5 text-white shadow-float">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-100">Current</p>
            <p className="mt-2 font-display text-2xl font-bold">Free trial</p>
            <p className="mt-2 text-sm text-white/70">
              Billing and entitlements unlock in Phase 6.
            </p>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
