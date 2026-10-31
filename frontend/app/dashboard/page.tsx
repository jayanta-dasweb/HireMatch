"use client";

import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { IconBriefcase, IconFile, IconUsers } from "@/components/admin/icons";
import { DashboardSkeleton } from "@/components/Loading";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function DashboardPage() {
  const { user, loading } = useCurrentUser();

  if (loading || !user) return <DashboardSkeleton />;

  const workspaces = user.memberships.length;
  const roles = Array.from(new Set(user.memberships.map((m) => m.role))).join(", ");

  return (
    <AdminShell title="Overview" userName={user.full_name} userEmail={user.email}>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950 md:text-3xl">
          Welcome back, {user.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Your multi-tenant foundation is ready. Resume intelligence ships in Phase 2.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Workspaces"
          value={String(workspaces)}
          hint="Organizations you belong to"
          icon={<IconUsers className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Resumes"
          value="0"
          hint="Upload unlocks in Phase 2"
          icon={<IconFile className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Open jobs"
          value="0"
          hint="Job matching comes next"
          icon={<IconBriefcase className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Email status"
          value={user.is_email_verified ? "Verified" : "Pending"}
          hint={user.locale}
          icon={<IconUsers className="h-5 w-5" />}
          tone={user.is_email_verified ? "brand" : "rose"}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Account"
          action={<Link href="/dashboard/settings" className="text-sm font-semibold text-brand-700">Edit</Link>}
        >
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-ink-50 pb-3">
              <dt className="text-ink-500">Full name</dt>
              <dd className="font-semibold text-ink-900">{user.full_name}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ink-50 pb-3">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-semibold text-ink-900">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-ink-50 pb-3">
              <dt className="text-ink-500">Roles</dt>
              <dd className="font-semibold capitalize text-ink-900">{roles || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Platform admin</dt>
              <dd className="font-semibold text-ink-900">{user.is_platform_admin ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Workspaces"
          action={<Link href="/dashboard/team" className="text-sm font-semibold text-brand-700">Manage</Link>}
        >
          <ul className="space-y-3">
            {user.memberships.map((m) => (
              <li
                key={m.organization_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-surface-muted px-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{m.organization_name}</p>
                  <p className="text-xs capitalize text-ink-500">{m.role.replace("_", " ")}</p>
                </div>
                {m.is_personal ? (
                  <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                    Personal
                  </span>
                ) : (
                  <span className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                    Team
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Quick actions">
          <div className="space-y-3">
            <Link href="/dashboard/settings" className="btn-primary w-full">
              Profile settings
            </Link>
            <Link href="/dashboard/team" className="btn-ghost w-full">
              View team & roles
            </Link>
            <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/60 p-4 text-xs leading-relaxed text-ink-500">
              Resume upload, semantic matching, and recruiter pipelines are queued for the next phases.
            </div>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
