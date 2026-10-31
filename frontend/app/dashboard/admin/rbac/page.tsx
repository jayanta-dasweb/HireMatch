"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { Field, PrimaryButton } from "@/components/ui";
import { friendlyErrorMessage } from "@/lib/errors";
import { useCurrentUser } from "@/lib/useCurrentUser";
import {
  RbacPermission,
  RbacRole,
  createPermission,
  createRole,
  fetchPermissions,
  fetchRoles,
  updateRole,
} from "@/lib/rbacApi";

export default function AccessControlPage() {
  const router = useRouter();
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [permCode, setPermCode] = useState("");
  const [permName, setPermName] = useState("");
  const [permGroup, setPermGroup] = useState("general");

  const [roleSlug, setRoleSlug] = useState("");
  const [roleName, setRoleName] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  async function reload() {
    const [p, r] = await Promise.all([fetchPermissions(), fetchRoles()]);
    setPermissions(p);
    setRoles(r.filter((x) => x.organization_id == null));
    if (!selectedRoleId && r.length) setSelectedRoleId(r[0].id);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!user.is_platform_admin) {
      router.replace("/dashboard");
      return;
    }
    reload().catch((err) => alert.error(friendlyErrorMessage(err, "Failed to load RBAC")));
  }, [user, loading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCreatePermission(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createPermission({ code: permCode, name: permName, group: permGroup });
      setPermCode("");
      setPermName("");
      await reload();
      alert.success("Permission added to catalog.", "Permission created");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create permission"));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateRole(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const role = await createRole({
        slug: roleSlug,
        name: roleName,
        is_system: true,
        permission_codes: [],
      });
      setRoleSlug("");
      setRoleName("");
      await reload();
      setSelectedRoleId(role.id);
      alert.success("System role created.", "Role created");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create role"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(code: string) {
    if (!selectedRole) return;
    const next = selectedRole.permissions.includes(code)
      ? selectedRole.permissions.filter((c) => c !== code)
      : [...selectedRole.permissions, code];
    setBusy(true);
    try {
      const updated = await updateRole(selectedRole.id, { permission_codes: next });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      alert.success("Role permissions updated.", "Matrix saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not update role"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;
  if (!user.is_platform_admin) return <DashboardSkeleton />;

  const groups = Array.from(new Set(permissions.map((p) => p.group))).sort();

  return (
    <AdminShell
      title="Access Control"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Access Control</h1>
        <p className="mt-1 text-sm text-ink-500">
          Spatie-style permissions, system roles, and role ↔ permission matrix.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Permissions catalog">
          <form onSubmit={onCreatePermission} className="mb-4 space-y-2 border-b border-ink-100 pb-4">
            <Field label="Code" required value={permCode} onChange={(e) => setPermCode(e.target.value)} placeholder="org.example.action" />
            <Field label="Name" required value={permName} onChange={(e) => setPermName(e.target.value)} />
            <Field label="Group" value={permGroup} onChange={(e) => setPermGroup(e.target.value)} />
            <PrimaryButton type="submit" disabled={busy} className="w-full">
              Add permission
            </PrimaryButton>
          </form>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {permissions.map((p) => (
              <li key={p.id} className="rounded-xl border border-ink-100 px-3 py-2">
                <p className="font-semibold text-ink-900">{p.code}</p>
                <p className="text-xs text-ink-500">
                  {p.name} · {p.group}
                </p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="System roles">
          <form onSubmit={onCreateRole} className="mb-4 space-y-2 border-b border-ink-100 pb-4">
            <Field label="Slug" required value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} placeholder="custom_role" />
            <Field label="Name" required value={roleName} onChange={(e) => setRoleName(e.target.value)} />
            <PrimaryButton type="submit" disabled={busy} className="w-full">
              Add system role
            </PrimaryButton>
          </form>
          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedRoleId === r.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-100 hover:bg-ink-50"
                  }`}
                >
                  <p className="font-semibold text-ink-900">{r.name}</p>
                  <p className="text-xs text-ink-500">
                    {r.slug} · {r.permissions.length} permissions
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={selectedRole ? `Matrix — ${selectedRole.name}` : "Permission matrix"}>
          {!selectedRole ? (
            <p className="text-sm text-ink-500">Select a role to edit permissions.</p>
          ) : (
            <div className="max-h-[32rem] space-y-4 overflow-y-auto">
              {groups.map((group) => (
                <div key={group}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{group}</p>
                  <ul className="space-y-1.5">
                    {permissions
                      .filter((p) => p.group === group)
                      .map((p) => {
                        const on = selectedRole.permissions.includes(p.code);
                        return (
                          <li key={p.id}>
                            <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={on}
                                disabled={busy}
                                onChange={() => togglePermission(p.code)}
                              />
                              <span>
                                <span className="block text-sm font-medium text-ink-900">{p.code}</span>
                                <span className="block text-xs text-ink-500">{p.name}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
