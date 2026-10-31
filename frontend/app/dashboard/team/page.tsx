"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { fetchMe, UserMe } from "@/lib/api";

export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => router.replace("/sign-in"));
  }, [router]);

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-ink-500">Loading…</div>;
  }

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
                        m.is_personal
                          ? "bg-brand-50 text-brand-700"
                          : "bg-sky-50 text-sky-700"
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
