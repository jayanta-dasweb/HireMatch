"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { IconBriefcase, IconUsers } from "@/components/admin/icons";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Field, PrimaryButton } from "@/components/ui";
import {
  AdminHealth,
  AdminOrg,
  AdminUser,
  AdminUserDetail,
  AuditLog,
  adminAssignUserOrgRole,
  adminCreateUser,
  adminFetchAudit,
  adminFetchHealth,
  adminFetchOrgs,
  adminFetchUser,
  adminFetchUsers,
  adminResetPassword,
  adminSetOrgActive,
  adminSetSpecialPermissions,
  adminSetUserActive,
  adminUpdateUser,
} from "@/lib/adminApi";
import { fetchPermissions, fetchRoles, RbacPermission, RbacRole } from "@/lib/rbacApi";
import { friendlyErrorMessage } from "@/lib/errors";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Tab = "users" | "orgs" | "activity";
type ManageMode = "account" | "access" | "password";

function ModalShell({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink-950">{title}</h2>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
        on ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("users");
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [manageMode, setManageMode] = useState<ManageMode>("account");
  const [resetPassword, setResetPassword] = useState("");
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [allPerms, setAllPerms] = useState<RbacPermission[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const [specialDraft, setSpecialDraft] = useState<Record<string, string[]>>({});
  const [accessOrgId, setAccessOrgId] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAdmin, setNewAdmin] = useState(false);

  async function openUser(u: AdminUser) {
    setSelected(u);
    setManageMode("account");
    setResetPassword("");
    setDetail(null);
    setBusy(true);
    try {
      const d = await adminFetchUser(u.id);
      setDetail(d);
      const rd: Record<string, string> = {};
      const sd: Record<string, string[]> = {};
      d.memberships.forEach((m) => {
        rd[m.organization_id] = m.role_id || m.role;
        sd[m.organization_id] = [...m.special_permissions];
      });
      setRoleDraft(rd);
      setSpecialDraft(sd);
      setAccessOrgId(d.memberships[0]?.organization_id ?? null);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not load user"));
    } finally {
      setBusy(false);
    }
  }

  async function loadAccessCatalog(orgId: string | null) {
    // Keep page_size well under API max (200). Do not send 200 — older cached bundles broke on le=100.
    const catalogPageSize = 50;
    try {
      const [r, p] = await Promise.all([
        fetchRoles({
          organization_id: orgId || undefined,
          include_system: true,
          is_active: true,
          page: 1,
          page_size: catalogPageSize,
        }),
        fetchPermissions({ is_active: true, page: 1, page_size: catalogPageSize }),
      ]);
      setRoles(r.items);
      setAllPerms(p.items);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not load roles/permissions"));
    }
  }

  async function reload() {
    const [h, u, o, a] = await Promise.all([
      adminFetchHealth(),
      adminFetchUsers(),
      adminFetchOrgs(),
      adminFetchAudit(50),
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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
  }, [orgs, search]);

  async function patchUser(target: AdminUser, body: Parameters<typeof adminUpdateUser>[1], ok: string) {
    setBusy(true);
    try {
      const updated = await adminUpdateUser(target.id, body);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSelected(updated);
      alert.success(ok, "Updated");
      const a = await adminFetchAudit(50);
      setAudit(a);
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(target: AdminUser) {
    if (target.id === user?.id && target.is_active) {
      alert.warning("You cannot disable your own account.");
      return;
    }
    setBusy(true);
    try {
      const updated = await adminSetUserActive(target.id, !target.is_active);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSelected(updated);
      alert.success(target.is_active ? "User disabled." : "User enabled.", "Updated");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onToggleOrg(target: AdminOrg) {
    setBusy(true);
    try {
      const updated = await adminSetOrgActive(target.id, !target.is_active);
      setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      alert.success(target.is_active ? "Organization disabled." : "Organization enabled.", "Updated");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
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
      setSelected(created);
      setTab("users");
      alert.success("User created.", "Done");
      await reload();
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create user"));
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await adminResetPassword(selected.id, resetPassword);
      setManageMode("account");
      setResetPassword("");
      alert.success("Password updated. Other sessions signed out.", "Done");
      await reload();
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRole(orgId: string) {
    if (!selected) return;
    const value = roleDraft[orgId];
    if (!value) return;
    setBusy(true);
    try {
      const byId = roles.find((r) => r.id === value);
      const body = byId ? { role_id: byId.id } : { role_slug: value };
      const d = await adminAssignUserOrgRole(selected.id, orgId, body);
      setDetail(d);
      setSelected(d);
      setUsers((prev) => prev.map((u) => (u.id === d.id ? d : u)));
      alert.success("Org role updated.", "Updated");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not assign role"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveSpecial(orgId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const d = await adminSetSpecialPermissions(selected.id, orgId, specialDraft[orgId] || []);
      setDetail(d);
      setSelected(d);
      setUsers((prev) => prev.map((u) => (u.id === d.id ? d : u)));
      alert.success("Special permissions saved.", "Updated");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not save permissions"));
    } finally {
      setBusy(false);
    }
  }

  function toggleSpecial(orgId: string, code: string) {
    setSpecialDraft((prev) => {
      const cur = new Set(prev[orgId] || []);
      if (cur.has(code)) cur.delete(code);
      else cur.add(code);
      return { ...prev, [orgId]: Array.from(cur).sort() };
    });
  }

  if (loading || !user) return <DashboardSkeleton />;
  if (!user.is_platform_admin) return <DashboardSkeleton />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Users" },
    { id: "orgs", label: "Organizations" },
    { id: "activity", label: "Recent activity" },
  ];

  return (
    <AdminShell title="Platform Admin" userName={user.full_name} userEmail={user.email} isPlatformAdmin>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950">Platform Admin</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-500">
            Manage accounts here. Open a user → Roles & permissions to assign an org role or special
            grants. Define the catalog in{" "}
            <Link href="/dashboard/admin/rbac" className="font-semibold text-brand-700">
              Access Control
            </Link>
            .
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          Create user
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === t.id ? "bg-brand-600 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        {(tab === "users" || tab === "orgs") && (
          <input
            className="admin-input ml-auto max-w-xs"
            placeholder={tab === "users" ? "Search users…" : "Search organizations…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>

      {tab === "users" && (
        <Panel title="Users">
          <p className="mb-3 text-xs text-ink-500">Click a row to manage that account. One place for all actions.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="px-2 py-3 font-medium">Name</th>
                  <th className="px-2 py-3 font-medium">Email</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer border-b border-ink-50 hover:bg-ink-50/70"
                    onClick={() => openUser(u)}
                  >
                    <td className="px-2 py-3 font-semibold text-ink-900">
                      {u.full_name}
                      {u.is_platform_admin && (
                        <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-ink-600">{u.email}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusPill on={u.is_active} onLabel="Active" offLabel="Disabled" />
                        <StatusPill on={u.is_email_verified} onLabel="Verified" offLabel="Unverified" />
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-xs font-semibold text-brand-700">Manage →</span>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-sm text-ink-400">
                      No users match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {tab === "orgs" && (
        <Panel title="Organizations">
          <ul className="divide-y divide-ink-50">
            {filteredOrgs.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{o.name}</p>
                  <p className="text-xs text-ink-500">
                    {o.slug} · {o.is_personal ? "Personal" : "Team org"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill on={o.is_active} onLabel="Active" offLabel="Disabled" />
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => onToggleOrg(o)}
                  >
                    {o.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === "activity" && (
        <Panel title="Recent activity">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="px-2 py-2 font-medium">Resource</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-b border-ink-50">
                  <td className="px-2 py-2 text-xs text-ink-500">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2 font-medium text-ink-800">{row.action}</td>
                  <td className="px-2 py-2 text-xs text-ink-500">
                    {row.resource_type || "—"}
                    {row.resource_id ? ` · ${row.resource_id.slice(0, 8)}` : ""}
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-sm text-ink-400">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      )}

      {selected && (
        <ModalShell
          title={selected.full_name}
          wide={manageMode === "access"}
          onClose={() => {
            setSelected(null);
            setDetail(null);
            setManageMode("account");
          }}
        >
          <p className="text-sm text-ink-500">{selected.email}</p>
          <p className="mt-1 text-xs text-ink-400">
            {(detail?.memberships.length ?? selected.membership_count)} workspace memberships
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { id: "account" as const, label: "Account" },
                { id: "access" as const, label: "Roles & permissions" },
                { id: "password" as const, label: "Password" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  manageMode === m.id ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
                }`}
                onClick={() => {
                  setManageMode(m.id);
                  if (m.id === "access") {
                    const oid = accessOrgId || detail?.memberships[0]?.organization_id || null;
                    setAccessOrgId(oid);
                    void loadAccessCatalog(oid);
                  }
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {manageMode === "account" && (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Account status</p>
                    <p className="text-xs text-ink-500">Disabled users cannot sign in.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy || selected.id === user.id}
                    onClick={() => onToggleActive(selected)}
                  >
                    {selected.is_active ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Email verified</p>
                    <p className="text-xs text-ink-500">Mark verified without sending email.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() =>
                      patchUser(
                        selected,
                        { is_email_verified: !selected.is_email_verified },
                        selected.is_email_verified ? "Marked unverified." : "Marked verified.",
                      )
                    }
                  >
                    {selected.is_email_verified ? "Mark unverified" : "Mark verified"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Platform admin</p>
                    <p className="text-xs text-ink-500">Full system access (not an org role).</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy || (selected.id === user.id && selected.is_platform_admin)}
                    onClick={() =>
                      patchUser(
                        selected,
                        { is_platform_admin: !selected.is_platform_admin },
                        selected.is_platform_admin ? "Admin access removed." : "Admin access granted.",
                      )
                    }
                  >
                    {selected.is_platform_admin ? "Remove admin" : "Make admin"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {manageMode === "access" && (
            <div className="mt-5 space-y-4">
              {!detail ? (
                <p className="text-sm text-ink-500">Loading memberships…</p>
              ) : detail.memberships.length === 0 ? (
                <p className="text-sm text-ink-500">This user has no organization memberships yet.</p>
              ) : (
                <>
                  <label className="block text-xs font-semibold text-ink-600">
                    Organization
                    <SearchableSelect
                      className="mt-1"
                      value={accessOrgId || ""}
                      onChange={(oid) => {
                        setAccessOrgId(oid);
                        void loadAccessCatalog(oid);
                      }}
                      searchPlaceholder="Search organizations…"
                      options={detail.memberships.map((m) => ({
                        value: m.organization_id,
                        label: `${m.organization_name} (${m.organization_slug})`,
                        keywords: m.organization_slug,
                      }))}
                    />
                  </label>

                  {detail.memberships
                    .filter((m) => m.organization_id === accessOrgId)
                    .map((m) => (
                      <div key={m.organization_id} className="space-y-4">
                        <div className="rounded-xl border border-ink-100 p-3">
                          <p className="text-sm font-semibold text-ink-900">Org role</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            Base permissions come from this role. Current: {m.role}
                          </p>
                          <div className="mt-3 flex flex-wrap items-end gap-2">
                            <SearchableSelect
                              className="min-w-0 flex-1"
                              value={roleDraft[m.organization_id] || ""}
                              onChange={(v) =>
                                setRoleDraft((prev) => ({
                                  ...prev,
                                  [m.organization_id]: v,
                                }))
                              }
                              placeholder="Search or select a role…"
                              searchPlaceholder="Type to filter roles…"
                              options={roles.map((r) => ({
                                value: r.id,
                                label: `${r.name} (${r.slug})${r.is_system ? "" : " · custom"}`,
                                keywords: `${r.slug} ${r.description || ""}`,
                              }))}
                            />
                            <button
                              type="button"
                              className="btn-primary px-4 py-2 text-xs"
                              disabled={busy}
                              onClick={() => onSaveRole(m.organization_id)}
                            >
                              Save role
                            </button>
                          </div>
                          {m.role_permissions.length > 0 && (
                            <p className="mt-2 text-[11px] text-ink-400">
                              Role grants: {m.role_permissions.join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="rounded-xl border border-ink-100 p-3">
                          <p className="text-sm font-semibold text-ink-900">Special permissions</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            Extra grants for this user only (on top of the role).
                          </p>
                          <input
                            className="admin-input mt-3"
                            placeholder="Search permissions…"
                            value={permSearch}
                            onChange={(e) => setPermSearch(e.target.value)}
                          />
                          <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                            {allPerms
                              .filter((p) => {
                                const q = permSearch.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  p.code.toLowerCase().includes(q) ||
                                  p.name.toLowerCase().includes(q) ||
                                  (p.group || "").toLowerCase().includes(q)
                                );
                              })
                              .map((p) => {
                              const checked = (specialDraft[m.organization_id] || []).includes(p.code);
                              const fromRole = m.role_permissions.includes(p.code);
                              return (
                                <label
                                  key={p.id}
                                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 rounded border-ink-300"
                                    checked={checked}
                                    onChange={() => toggleSpecial(m.organization_id, p.code)}
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-ink-800">{p.code}</span>
                                    <span className="block text-[11px] text-ink-400">
                                      {p.name}
                                      {fromRole ? " · already on role" : ""}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                            {allPerms.length === 0 && (
                              <p className="text-xs text-ink-400">No active permissions found.</p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn-primary mt-3 px-4 py-2 text-xs"
                            disabled={busy}
                            onClick={() => onSaveSpecial(m.organization_id)}
                          >
                            Save special permissions
                          </button>
                          {m.effective_permissions.length > 0 && (
                            <p className="mt-2 text-[11px] text-ink-400">
                              Effective: {m.effective_permissions.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}

          {manageMode === "password" && (
            <form onSubmit={onReset} className="mt-5 space-y-3">
              <Field
                label="New password"
                type="password"
                required
                minLength={8}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setManageMode("account")}>
                  Back
                </button>
                <PrimaryButton type="submit" disabled={busy} className="w-auto">
                  Save password
                </PrimaryButton>
              </div>
            </form>
          )}
        </ModalShell>
      )}

      {showCreate && (
        <ModalShell title="Create user" onClose={() => setShowCreate(false)}>
          <form onSubmit={onCreate} className="space-y-3" noValidate>
            <Field label="Full name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Field label="Email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
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
              Also grant platform admin
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={busy} className="w-auto">
                {busy ? "Creating…" : "Create"}
              </PrimaryButton>
            </div>
          </form>
        </ModalShell>
      )}
    </AdminShell>
  );
}
