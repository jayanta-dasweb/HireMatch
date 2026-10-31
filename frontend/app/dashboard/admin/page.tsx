"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { IconBriefcase, IconUsers } from "@/components/admin/icons";
import { DashboardSkeleton } from "@/components/Loading";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Health = {
  status: string;
  database: string;
  organization_count: number;
  user_count: number;
  active_user_count: number;
};

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_platform_admin: boolean;
  membership_count: number;
};

type Org = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  is_active: boolean;
};

export default function PlatformAdminPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [health, setHealth] = useState<Health | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!user.is_platform_admin) {
      router.replace("/dashboard");
      return;
    }

    Promise.all([
      apiFetch<Health>("/admin/system-health", {}, true),
      apiFetch<AdminUser[]>("/admin/users", {}, true),
      apiFetch<Org[]>("/admin/organizations", {}, true),
    ])
      .then(([h, u, o]) => {
        setHealth(h);
        setUsers(u);
        setOrgs(o);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admin data"));
  }, [user, loading, router]);

  async function toggleActive(target: AdminUser) {
    setBusyId(target.id);
    setError(null);
    try {
      const updated = await apiFetch<AdminUser>(
        `/admin/users/${target.id}/active`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !target.is_active }),
        },
        true,
      );
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Platform Admin</h1>
        <p className="mt-1 text-sm text-ink-500">Users, organizations, and system status.</p>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-rose-600">{error}</p>}

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
                  <th className="px-2 py-3 font-medium">Name</th>
                  <th className="px-2 py-3 font-medium">Email</th>
                  <th className="px-2 py-3 font-medium">Status</th>
                  <th className="px-2 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50">
                    <td className="px-2 py-3 font-semibold text-ink-900">
                      {u.full_name}
                      {u.is_platform_admin && (
                        <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                          admin
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-ink-600">{u.email}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          u.is_active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="btn-ghost px-3 py-1.5 text-xs"
                        disabled={busyId === u.id || u.id === user.id}
                        onClick={() => toggleActive(u)}
                      >
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="All organizations">
          <ul className="space-y-3">
            {orgs.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-surface-muted px-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{o.name}</p>
                  <p className="text-xs text-ink-500">{o.slug}</p>
                </div>
                <span
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    o.is_personal ? "bg-brand-50 text-brand-700" : "bg-sky-50 text-sky-700"
                  }`}
                >
                  {o.is_personal ? "Personal" : "Org"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
