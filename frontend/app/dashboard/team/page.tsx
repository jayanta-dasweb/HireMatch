"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { DashboardSkeleton } from "@/components/Loading";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function TeamPage() {
  const { user, loading } = useCurrentUser();
  if (loading || !user) return <DashboardSkeleton />;

  return (
    <AdminShell title="Team" userName={user.full_name} userEmail={user.email}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Team & workspaces</h1>
        <p className="mt-1 text-sm text-ink-500">
          Memberships for your account. Invite flows are available via the API in Phase 1.
        </p>
      </div>

      <Panel title="Your memberships">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500">
                <th className="px-2 py-3 font-medium">Workspace</th>
                <th className="px-2 py-3 font-medium">Slug</th>
                <th className="px-2 py-3 font-medium">Role</th>
                <th className="px-2 py-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {user.memberships.map((m) => (
                <tr key={m.organization_id} className="border-b border-ink-50">
                  <td className="px-2 py-3 font-semibold text-ink-900">{m.organization_name}</td>
                  <td className="px-2 py-3 text-ink-500">{m.organization_slug}</td>
                  <td className="px-2 py-3 capitalize text-ink-700">{m.role.replace("_", " ")}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        m.is_personal ? "bg-brand-50 text-brand-700" : "bg-sky-50 text-sky-700"
                      }`}
                    >
                      {m.is_personal ? "Personal" : "Organization"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AdminShell>
  );
}
