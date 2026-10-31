"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { IconBriefcase, IconUsers } from "@/components/admin/icons";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { Field, PrimaryButton } from "@/components/ui";
import {
  AdminHealth,
  AdminOrg,
  AdminUser,
  AuditLog,
  adminCreateUser,
  adminFetchAudit,
  adminFetchHealth,
  adminFetchOrgs,
  adminFetchUsers,
  adminResetPassword,
  adminSetOrgActive,
  adminSetUserActive,
  adminUpdateUser,
} from "@/lib/adminApi";
import { friendlyErrorMessage } from "@/lib/errors";
import { useCurrentUser } from "@/lib/useCurrentUser";

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
        <h2 className="font-display text-xl font-bold text-ink-950">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [h, u, o, a] = await Promise.all([
      adminFetchHealth(),
      adminFetchUsers(),
      adminFetchOrgs(),
      adminFetchAudit(80),
    ]);
    setHealth(h);
    setUsers(u);
    setOrgs(o);
    setAudit(a);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!user.is_platform_admin) {
      router.replace("/dashboard");
      return;
    }
    reload().catch((err) => alert.error(friendlyErrorMessage(err, "Failed to load admin data")));
  }, [user, loading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAction(id: string, fn: () => Promise<void>, okMsg: string) {
    setBusyId(id);
    try {
      await fn();
      alert.success(okMsg, "Done");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Action failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(target: AdminUser) {
    await runAction(
      target.id,
      async () => {
        const updated = await adminSetUserActive(target.id, !target.is_active);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      },
      target.is_active ? "User disabled." : "User enabled.",
    );
  }

  async function toggleAdmin(target: AdminUser) {
    if (target.id === user?.id && target.is_platform_admin) {
      alert.warning("You cannot remove your own platform admin access.");
      return;
    }
    await runAction(
      `admin-${target.id}`,
      async () => {
        const updated = await adminUpdateUser(target.id, {
          is_platform_admin: !target.is_platform_admin,
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      },
      target.is_platform_admin ? "Platform admin revoked." : "Platform admin granted.",
    );
  }

  async function toggleVerified(target: AdminUser) {
    await runAction(
      `verify-${target.id}`,
      async () => {
        const updated = await adminUpdateUser(target.id, {
          is_email_verified: !target.is_email_verified,
        });
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      },
      target.is_email_verified ? "Email marked unverified." : "Email marked verified.",
    );
  }

  async function toggleOrg(target: AdminOrg) {
    await runAction(
      `org-${target.id}`,
      async () => {
        const updated = await adminSetOrgActive(target.id, !target.is_active);
        setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      },
      target.is_active ? "Organization disabled." : "Organization enabled.",
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await adminCreateUser({
        email: newEmail.trim(),
        full_name: newName.trim(),
        password: newPassword,
        is_platform_admin: newAdmin,
        is_email_verified: true,
        is_active: true,
      });
      setUsers((prev) => [created, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewAdmin(false);
      alert.success("User created with a personal workspace.", "User created");
      const a = await adminFetchAudit(80);
      setAudit(a);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create user"));
    } finally {
      setSaving(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    try {
      await adminResetPassword(resetTarget.id, resetPassword);
      setResetTarget(null);
      setResetPassword("");
      alert.success("Password updated. Their other sessions were signed out.", "Password reset");
      const a = await adminFetchAudit(80);
      setAudit(a);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not reset password"));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;
  if (!user.is_platform_admin) return <DashboardSkeleton />;

  return (
    <AdminShell
      title="Platform Admin"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950">Platform Admin</h1>
          <p className="mt-1 text-sm text-ink-500">Manage users, organizations, and audit from here.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          Create user
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={String(health?.user_count ?? "—")}
          hint={`${health?.active_user_count ?? 0} active`}
          icon={<IconUsers className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Organizations"
          value={String(health?.organization_count ?? "—")}
          hint="All tenants"
          icon={<IconBriefcase className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Database"
          value={health?.database === "up" ? "Up" : "—"}
          hint={health?.status || "loading"}
          icon={<IconBriefcase className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Your role"
          value="Admin"
          hint="platform_admin"
          icon={<IconUsers className="h-5 w-5" />}
          tone="rose"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel title="All users">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="px-2 py-3 font-medium">User</th>
                  <th className="px-2 py-3 font-medium">Flags</th>
                  <th className="px-2 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50 align-top">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-ink-900">{u.full_name}</p>
                      <p className="text-xs text-ink-500">{u.email}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{u.membership_count} memberships</p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            u.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                          }`}
                        >
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            u.is_email_verified ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {u.is_email_verified ? "Verified" : "Unverified"}
                        </span>
                        {u.is_platform_admin && (
                          <span className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold uppercase text-rose-700">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          disabled={busyId === u.id || u.id === user.id}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          disabled={busyId === `admin-${u.id}` || (u.id === user.id && u.is_platform_admin)}
                          onClick={() => toggleAdmin(u)}
                        >
                          {u.is_platform_admin ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          disabled={busyId === `verify-${u.id}`}
                          onClick={() => toggleVerified(u)}
                        >
                          {u.is_email_verified ? "Unverify" : "Verify"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          onClick={() => {
                            setResetPassword("");
                            setResetTarget(u);
                          }}
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Organizations">
            <ul className="space-y-3">
              {orgs.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-surface-muted px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{o.name}</p>
                    <p className="text-xs text-ink-500">{o.slug}</p>
                    <div className="mt-1 flex gap-1">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                          o.is_personal ? "bg-brand-50 text-brand-700" : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {o.is_personal ? "Personal" : "Org"}
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                          o.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {o.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busyId === `org-${o.id}`}
                    onClick={() => toggleOrg(o)}
                  >
                    {o.is_active ? "Disable" : "Enable"}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent audit">
            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-ink-500">
                    <th className="px-2 py-2 font-medium">Action</th>
                    <th className="px-2 py-2 font-medium">Resource</th>
                    <th className="px-2 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id} className="border-b border-ink-50">
                      <td className="px-2 py-2 font-medium text-ink-800">{row.action}</td>
                      <td className="px-2 py-2 text-xs text-ink-500">
                        {row.resource_type || "—"}
                        {row.resource_id ? ` · ${row.resource_id.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-2 py-2 text-xs text-ink-500">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-sm text-ink-400">
                        No audit events yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>

      {showCreate && (
        <ModalShell title="Create user" onClose={() => setShowCreate(false)}>
          <form onSubmit={onCreate} className="space-y-3" noValidate>
            <Field label="Full name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Field
              label="Email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={newAdmin}
                onChange={(e) => setNewAdmin(e.target.checked)}
                className="rounded border-ink-300"
              />
              Grant platform admin
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={saving} className="w-auto">
                {saving ? "Creating…" : "Create"}
              </PrimaryButton>
            </div>
          </form>
        </ModalShell>
      )}

      {resetTarget && (
        <ModalShell title={`Reset password — ${resetTarget.email}`} onClose={() => setResetTarget(null)}>
          <form onSubmit={onReset} className="space-y-3" noValidate>
            <Field
              label="New password"
              type="password"
              required
              minLength={8}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setResetTarget(null)}>
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={saving} className="w-auto">
                {saving ? "Saving…" : "Reset password"}
              </PrimaryButton>
            </div>
          </form>
        </ModalShell>
      )}
    </AdminShell>
  );
}
