"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { Field, PrimaryButton } from "@/components/ui";
import { Membership } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { clearUserCache, useCurrentUser } from "@/lib/useCurrentUser";
import {
  OrgMember,
  RbacPermission,
  RbacRole,
  assignMemberRole,
  createRole,
  fetchOrgMembers,
  fetchPermissions,
  fetchRoles,
  inviteOrgMember,
  updateRole,
} from "@/lib/rbacApi";

function can(m: Membership | undefined, code: string) {
  if (!m) return false;
  return (m.permissions || []).includes(code);
}

export default function TeamPage() {
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const [orgId, setOrgId] = useState<string>("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [busy, setBusy] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleSlug, setInviteRoleSlug] = useState("recruiter");

  const [customSlug, setCustomSlug] = useState("");
  const [customName, setCustomName] = useState("");
  const [editRoleId, setEditRoleId] = useState<string | null>(null);

  const membership = useMemo(
    () => user?.memberships.find((m) => m.organization_id === orgId),
    [user, orgId],
  );

  const orgRoles = useMemo(() => roles.filter((r) => r.organization_id === orgId), [roles, orgId]);
  const assignableRoles = useMemo(
    () => roles.filter((r) => r.is_active && (r.organization_id == null || r.organization_id === orgId)),
    [roles, orgId],
  );
  const editRole = useMemo(() => orgRoles.find((r) => r.id === editRoleId) || null, [orgRoles, editRoleId]);

  async function reload(targetOrg: string) {
    const [m, r] = await Promise.all([
      fetchOrgMembers(targetOrg),
      fetchRoles({ organization_id: targetOrg, include_system: true, is_active: true, page: 1, page_size: 100 }),
    ]);
    setMembers(m);
    setRoles(r.items);
    if (can(user?.memberships.find((x) => x.organization_id === targetOrg), "org.roles.manage") || user?.is_platform_admin) {
      try {
        const perms = await fetchPermissions({ is_active: true, page: 1, page_size: 100 });
        setPermissions(perms.items);
      } catch {
        setPermissions([]);
      }
    }
  }

  useEffect(() => {
    if (!user) return;
    const first = user.memberships[0]?.organization_id || "";
    setOrgId((prev) => prev || first);
  }, [user]);

  useEffect(() => {
    if (!user || !orgId) return;
    reload(orgId).catch((err) => alert.error(friendlyErrorMessage(err, "Failed to load team")));
  }, [user, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await inviteOrgMember(orgId, { email: inviteEmail.trim(), role_slug: inviteRoleSlug });
      setInviteEmail("");
      alert.success(
        res.invite_token
          ? `Invite sent. Dev token: ${res.invite_token}`
          : "Invitation created.",
        "Invite sent",
      );
      await reload(orgId);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Invite failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onChangeRole(member: OrgMember, roleSlug: string) {
    setBusy(true);
    try {
      await assignMemberRole(orgId, member.user_id, { role_slug: roleSlug });
      await reload(orgId);
      clearUserCache();
      alert.success("Member role updated.", "Role assigned");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not change role"));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateOrgRole(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const role = await createRole({
        slug: customSlug,
        name: customName,
        organization_id: orgId,
        is_system: false,
        permission_codes: ["org.view", "org.members.view"],
      });
      setCustomSlug("");
      setCustomName("");
      await reload(orgId);
      setEditRoleId(role.id);
      alert.success("Custom org role created.", "Role created");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create role"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleOrgRolePerm(code: string) {
    if (!editRole) return;
    const next = editRole.permissions.includes(code)
      ? editRole.permissions.filter((c) => c !== code)
      : [...editRole.permissions, code];
    setBusy(true);
    try {
      const updated = await updateRole(editRole.id, { permission_codes: next });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      alert.success("Org role permissions saved.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not update role"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;

  const canInvite = user.is_platform_admin || can(membership, "org.members.invite");
  const canManageMembers = user.is_platform_admin || can(membership, "org.members.manage");
  const canManageRoles = user.is_platform_admin || can(membership, "org.roles.manage");

  return (
    <AdminShell
      title="Team"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin={user.is_platform_admin}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950">Team & access</h1>
          <p className="mt-1 text-sm text-ink-500">Members, invites, and organization roles.</p>
        </div>
        <label className="text-sm font-medium text-ink-700">
          Workspace
          <select
            className="admin-input mt-1 min-w-[220px]"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {user.memberships.map((m) => (
              <option key={m.organization_id} value={m.organization_id}>
                {m.organization_name} ({m.role})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Members">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="px-2 py-3 font-medium">Person</th>
                  <th className="px-2 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-ink-50">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-ink-900">{m.full_name}</p>
                      <p className="text-xs text-ink-500">{m.email}</p>
                    </td>
                    <td className="px-2 py-3">
                      {canManageMembers ? (
                        <select
                          className="admin-input py-1.5 text-xs"
                          value={m.role}
                          disabled={busy || m.user_id === user.id}
                          onChange={(e) => onChangeRole(m, e.target.value)}
                        >
                          {assignableRoles.map((r) => (
                            <option key={r.id} value={r.slug}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="capitalize text-ink-700">{m.role.replaceAll("_", " ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          {canInvite && (
            <Panel title="Invite member">
              <form onSubmit={onInvite} className="space-y-3">
                <Field
                  label="Email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <label className="block text-sm font-medium text-ink-700">
                  Role
                  <select
                    className="admin-input"
                    value={inviteRoleSlug}
                    onChange={(e) => setInviteRoleSlug(e.target.value)}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r.id} value={r.slug}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <PrimaryButton type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send invite"}
                </PrimaryButton>
              </form>
            </Panel>
          )}

          {canManageRoles && (
            <Panel title="Organization roles">
              <form onSubmit={onCreateOrgRole} className="mb-4 space-y-2 border-b border-ink-100 pb-4">
                <Field label="Slug" required value={customSlug} onChange={(e) => setCustomSlug(e.target.value)} />
                <Field label="Name" required value={customName} onChange={(e) => setCustomName(e.target.value)} />
                <PrimaryButton type="submit" disabled={busy} className="w-full">
                  Create org role
                </PrimaryButton>
              </form>
              <ul className="mb-3 space-y-2">
                {orgRoles.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        editRoleId === r.id ? "border-brand-500 bg-brand-50" : "border-ink-100"
                      }`}
                      onClick={() => setEditRoleId(r.id)}
                    >
                      <span className="font-semibold text-ink-900">{r.name}</span>
                      <span className="ml-2 text-xs text-ink-500">{r.slug}</span>
                    </button>
                  </li>
                ))}
                {orgRoles.length === 0 && (
                  <p className="text-sm text-ink-400">No custom roles yet. System roles still apply.</p>
                )}
              </ul>
              {editRole && (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-ink-100 p-2">
                  <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Permissions — {editRole.name}</p>
                  {permissions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={editRole.permissions.includes(p.code)}
                        disabled={busy}
                        onChange={() => toggleOrgRolePerm(p.code)}
                      />
                      <span>{p.code}</span>
                    </label>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
