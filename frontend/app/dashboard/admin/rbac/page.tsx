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
  PageMeta,
  RbacAuditItem,
  RbacPermission,
  RbacPermissionGroup,
  RbacRole,
  actorLabel,
  createGroupMaster,
  createPermission,
  createRole,
  fetchGroupMasters,
  fetchPermissionGroups,
  fetchPermissions,
  fetchRbacAudit,
  fetchRoles,
  updateGroupMaster,
  updatePermission,
  updateRole,
} from "@/lib/rbacApi";

type Tab = "groups" | "permissions" | "roles" | "audit";

function MetaLine({
  createdAt,
  updatedAt,
  createdBy,
  updatedBy,
}: {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}) {
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
      Created {new Date(createdAt).toLocaleString()} by {createdBy}
      <br />
      Updated {new Date(updatedAt).toLocaleString()} by {updatedBy}
    </p>
  );
}

function Pager({
  meta,
  onPage,
}: {
  meta: PageMeta | null;
  onPage: (p: number) => void;
}) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
      <span>
        {meta.total} total · page {meta.page}/{meta.pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs"
          disabled={meta.page >= meta.pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function AccessControlPage() {
  const router = useRouter();
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("permissions");
  const [busy, setBusy] = useState(false);

  const [permQ, setPermQ] = useState("");
  const [permGroup, setPermGroup] = useState("");
  const [permActive, setPermActive] = useState<"" | "true" | "false">("");
  const [permPage, setPermPage] = useState(1);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [permMeta, setPermMeta] = useState<PageMeta | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  const [roleQ, setRoleQ] = useState("");
  const [roleActive, setRoleActive] = useState<"" | "true" | "false">("");
  const [rolePage, setRolePage] = useState(1);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [roleMeta, setRoleMeta] = useState<PageMeta | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [matrixQ, setMatrixQ] = useState("");
  const [matrixPerms, setMatrixPerms] = useState<RbacPermission[]>([]);

  const [auditQ, setAuditQ] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const [audit, setAudit] = useState<RbacAuditItem[]>([]);
  const [auditMeta, setAuditMeta] = useState<PageMeta | null>(null);

  const [permCode, setPermCode] = useState("");
  const [permName, setPermName] = useState("");
  const [permGroupNew, setPermGroupNew] = useState("general");
  const [roleSlug, setRoleSlug] = useState("");
  const [roleName, setRoleName] = useState("");

  const [groupMasters, setGroupMasters] = useState<RbacPermissionGroup[]>([]);
  const [groupMeta, setGroupMeta] = useState<PageMeta | null>(null);
  const [groupQ, setGroupQ] = useState("");
  const [groupPage, setGroupPage] = useState(1);
  const [groupSlug, setGroupSlug] = useState("");
  const [groupName, setGroupName] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  async function loadGroups(page = groupPage) {
    const res = await fetchGroupMasters({ q: groupQ || undefined, page, page_size: 50 });
    setGroupMasters(res.items);
    setGroupMeta(res.meta);
    setGroupPage(res.meta.page);
  }

  async function loadPermissions(page = permPage) {
    const res = await fetchPermissions({
      q: permQ || undefined,
      group: permGroup || undefined,
      is_active: permActive === "" ? undefined : permActive === "true",
      page,
      page_size: 20,
    });
    setPermissions(res.items);
    setPermMeta(res.meta);
    setPermPage(res.meta.page);
  }

  async function loadRoles(page = rolePage) {
    const res = await fetchRoles({
      q: roleQ || undefined,
      is_active: roleActive === "" ? undefined : roleActive === "true",
      page,
      page_size: 20,
    });
    setRoles(res.items);
    setRoleMeta(res.meta);
    setRolePage(res.meta.page);
    if (!selectedRoleId && res.items.length) setSelectedRoleId(res.items[0].id);
  }

  async function loadMatrixPerms() {
    const res = await fetchPermissions({
      q: matrixQ || undefined,
      is_active: true,
      page: 1,
      page_size: 100,
    });
    setMatrixPerms(res.items);
  }

  async function loadAudit(page = auditPage) {
    const res = await fetchRbacAudit({ q: auditQ || undefined, page, page_size: 25 });
    setAudit(res.items);
    setAuditMeta(res.meta);
    setAuditPage(res.meta.page);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!user.is_platform_admin) {
      router.replace("/dashboard");
      return;
    }
    fetchPermissionGroups()
      .then(setGroups)
      .catch(() => setGroups([]));
    loadGroups(1).catch((err) => alert.error(friendlyErrorMessage(err)));
    loadPermissions(1).catch((err) => alert.error(friendlyErrorMessage(err)));
    loadRoles(1).catch((err) => alert.error(friendlyErrorMessage(err)));
    loadAudit(1).catch(() => undefined);
  }, [user, loading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createGroupMaster({ slug: groupSlug, name: groupName, is_active: true });
      setGroupSlug("");
      setGroupName("");
      await loadGroups(1);
      const slugs = await fetchPermissionGroups();
      setGroups(slugs);
      await loadAudit(1);
      alert.success("Permission group created.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleGroupActive(g: RbacPermissionGroup) {
    setBusy(true);
    try {
      await updateGroupMaster(g.id, { is_active: !g.is_active });
      await loadGroups(groupPage);
      const slugs = await fetchPermissionGroups();
      setGroups(slugs);
      await loadAudit(1);
      alert.success(g.is_active ? "Group deactivated." : "Group activated.", "Status");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab === "roles" && selectedRoleId) {
      loadMatrixPerms().catch(() => undefined);
    }
  }, [tab, selectedRoleId, matrixQ]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCreatePermission(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createPermission({ code: permCode, name: permName, group: permGroupNew, is_active: true });
      setPermCode("");
      setPermName("");
      await loadPermissions(1);
      await loadAudit(1);
      alert.success("Permission created.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onCreateRole(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const role = await createRole({ slug: roleSlug, name: roleName, is_system: true, permission_codes: [] });
      setRoleSlug("");
      setRoleName("");
      await loadRoles(1);
      setSelectedRoleId(role.id);
      await loadAudit(1);
      alert.success("Role created.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePermActive(p: RbacPermission) {
    setBusy(true);
    try {
      await updatePermission(p.id, { is_active: !p.is_active });
      await loadPermissions(permPage);
      await loadAudit(1);
      alert.success(p.is_active ? "Permission deactivated." : "Permission activated.", "Status");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRoleActive(r: RbacRole) {
    setBusy(true);
    try {
      await updateRole(r.id, { is_active: !r.is_active });
      await loadRoles(rolePage);
      await loadAudit(1);
      alert.success(r.is_active ? "Role deactivated." : "Role activated.", "Status");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMatrix(code: string) {
    if (!selectedRole) return;
    const next = selectedRole.permissions.includes(code)
      ? selectedRole.permissions.filter((c) => c !== code)
      : [...selectedRole.permissions, code];
    setBusy(true);
    try {
      const updated = await updateRole(selectedRole.id, { permission_codes: next });
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      await loadAudit(1);
      alert.success("Role permissions updated.", "Matrix saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;
  if (!user.is_platform_admin) return <DashboardSkeleton />;

  const tabs: { id: Tab; label: string }[] = [
    { id: "groups", label: "Groups" },
    { id: "permissions", label: "Permissions" },
    { id: "roles", label: "Roles & matrix" },
    { id: "audit", label: "Who / when" },
  ];

  return (
    <AdminShell title="Permission catalog" userName={user.full_name} userEmail={user.email} isPlatformAdmin>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Permission catalog</h1>
        <p className="mt-1 text-sm text-ink-500">
          Group = folder for permissions. Create groups first, then permissions, then attach them to roles.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>

      {tab === "groups" && (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Panel title="Add group">
            <p className="mb-3 text-xs text-ink-500">
              A group is only a category (like Members / Settings). It is not a role.
            </p>
            <form onSubmit={onCreateGroup} className="space-y-2">
              <Field label="Slug" required value={groupSlug} onChange={(e) => setGroupSlug(e.target.value)} placeholder="billing" />
              <Field label="Name" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Billing" />
              <PrimaryButton type="submit" disabled={busy} className="w-full">
                Add group
              </PrimaryButton>
            </form>
          </Panel>
          <Panel title="Permission groups master">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className="admin-input max-w-xs flex-1"
                placeholder="Search groups…"
                value={groupQ}
                onChange={(e) => setGroupQ(e.target.value)}
              />
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => loadGroups(1).catch((err) => alert.error(friendlyErrorMessage(err)))}
              >
                Search
              </button>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="px-2 py-2 font-medium">Group</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">History</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {groupMasters.map((g) => (
                  <tr key={g.id} className="border-b border-ink-50 align-top">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-ink-900">{g.name}</p>
                      <p className="text-xs text-ink-500">{g.slug}</p>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          g.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {g.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <MetaLine
                        createdAt={g.created_at}
                        updatedAt={g.updated_at}
                        createdBy={actorLabel(g.created_by)}
                        updatedBy={actorLabel(g.updated_by)}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="btn-ghost px-2.5 py-1 text-xs"
                        disabled={busy}
                        onClick={() => toggleGroupActive(g)}
                      >
                        {g.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager meta={groupMeta} onPage={(p) => loadGroups(p)} />
          </Panel>
        </div>
      )}

      {tab === "permissions" && (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Panel title="Add permission">
            <form onSubmit={onCreatePermission} className="space-y-2">
              <Field label="Code" required value={permCode} onChange={(e) => setPermCode(e.target.value)} placeholder="org.example.action" />
              <Field label="Name" required value={permName} onChange={(e) => setPermName(e.target.value)} />
              <label className="block text-sm font-medium text-ink-700">
                Group
                <select
                  className="admin-input"
                  value={permGroupNew}
                  onChange={(e) => setPermGroupNew(e.target.value)}
                  required
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-ink-400">Pick from Groups master. Create groups in the Groups tab first.</p>
              <PrimaryButton type="submit" disabled={busy || groups.length === 0} className="w-full">
                Add permission
              </PrimaryButton>
            </form>
          </Panel>
          <Panel title="Permissions catalog">
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <input
                className="admin-input"
                placeholder="Search code or name…"
                value={permQ}
                onChange={(e) => setPermQ(e.target.value)}
              />
              <select className="admin-input" value={permGroup} onChange={(e) => setPermGroup(e.target.value)}>
                <option value="">All groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                className="admin-input"
                value={permActive}
                onChange={(e) => setPermActive(e.target.value as "" | "true" | "false")}
              >
                <option value="">All status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-ghost mb-3 px-3 py-1.5 text-xs"
              onClick={() => loadPermissions(1).catch((err) => alert.error(friendlyErrorMessage(err)))}
            >
              Apply filters
            </button>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-ink-500">
                    <th className="px-2 py-2 font-medium">Permission</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">History</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-b border-ink-50 align-top">
                      <td className="px-2 py-3">
                        <p className="font-semibold text-ink-900">{p.code}</p>
                        <p className="text-xs text-ink-500">
                          {p.name} · {p.group}
                        </p>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                            p.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                          }`}
                        >
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <MetaLine
                          createdAt={p.created_at}
                          updatedAt={p.updated_at}
                          createdBy={actorLabel(p.created_by)}
                          updatedBy={actorLabel(p.updated_by)}
                        />
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-1 text-xs"
                          disabled={busy}
                          onClick={() => togglePermActive(p)}
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager meta={permMeta} onPage={(p) => loadPermissions(p)} />
          </Panel>
        </div>
      )}

      {tab === "roles" && (
        <div className="grid gap-4 xl:grid-cols-[280px_280px_1fr]">
          <Panel title="Add system role">
            <form onSubmit={onCreateRole} className="space-y-2">
              <Field label="Slug" required value={roleSlug} onChange={(e) => setRoleSlug(e.target.value)} />
              <Field label="Name" required value={roleName} onChange={(e) => setRoleName(e.target.value)} />
              <PrimaryButton type="submit" disabled={busy} className="w-full">
                Add role
              </PrimaryButton>
            </form>
            <div className="mt-4 space-y-2">
              <input
                className="admin-input"
                placeholder="Search roles…"
                value={roleQ}
                onChange={(e) => setRoleQ(e.target.value)}
              />
              <select
                className="admin-input"
                value={roleActive}
                onChange={(e) => setRoleActive(e.target.value as "" | "true" | "false")}
              >
                <option value="">All status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <button
                type="button"
                className="btn-ghost w-full px-3 py-1.5 text-xs"
                onClick={() => loadRoles(1).catch((err) => alert.error(friendlyErrorMessage(err)))}
              >
                Apply filters
              </button>
            </div>
          </Panel>

          <Panel title="Roles">
            <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(r.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedRoleId === r.id ? "border-brand-500 bg-brand-50" : "border-ink-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink-900">{r.name}</p>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {r.is_active ? "Active" : "Off"}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500">
                      {r.slug} · {r.permissions.length} perms
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <Pager meta={roleMeta} onPage={(p) => loadRoles(p)} />
          </Panel>

          <Panel title={selectedRole ? `Matrix — ${selectedRole.name}` : "Permission matrix"}>
            {!selectedRole ? (
              <p className="text-sm text-ink-500">Select a role.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    className="admin-input flex-1"
                    placeholder="Search permissions in matrix…"
                    value={matrixQ}
                    onChange={(e) => setMatrixQ(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={() => toggleRoleActive(selectedRole)}
                  >
                    {selectedRole.is_active ? "Deactivate role" : "Activate role"}
                  </button>
                </div>
                <MetaLine
                  createdAt={selectedRole.created_at}
                  updatedAt={selectedRole.updated_at}
                  createdBy={actorLabel(selectedRole.created_by)}
                  updatedBy={actorLabel(selectedRole.updated_by)}
                />
                <div className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto">
                  {matrixPerms.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedRole.permissions.includes(p.code)}
                        disabled={busy}
                        onChange={() => toggleMatrix(p.code)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink-900">{p.code}</span>
                        <span className="block text-xs text-ink-500">
                          {p.name} · {p.group}
                        </span>
                      </span>
                    </label>
                  ))}
                  {matrixPerms.length === 0 && (
                    <p className="text-sm text-ink-400">No active permissions match this search.</p>
                  )}
                </div>
              </>
            )}
          </Panel>
        </div>
      )}

      {tab === "audit" && (
        <Panel title="RBAC change history">
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              className="admin-input max-w-md flex-1"
              placeholder="Search action or resource…"
              value={auditQ}
              onChange={(e) => setAuditQ(e.target.value)}
            />
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => loadAudit(1).catch((err) => alert.error(friendlyErrorMessage(err)))}
            >
              Search
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-ink-500">
                  <th className="px-2 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Who</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                  <th className="px-2 py-2 font-medium">Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id} className="border-b border-ink-50">
                    <td className="px-2 py-2 text-xs text-ink-500">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2">
                      <p className="font-medium text-ink-900">{actorLabel(row.actor)}</p>
                      <p className="text-xs text-ink-400">{row.actor?.email}</p>
                    </td>
                    <td className="px-2 py-2 font-medium text-ink-800">{row.action}</td>
                    <td className="px-2 py-2 text-xs text-ink-500">
                      {row.resource_type || "—"}
                      {row.resource_id ? ` · ${row.resource_id}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager meta={auditMeta} onPage={(p) => loadAudit(p)} />
        </Panel>
      )}
    </AdminShell>
  );
}
