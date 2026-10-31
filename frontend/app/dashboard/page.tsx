"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { IconBriefcase, IconFile, IconUsers } from "@/components/admin/icons";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { Field, PrimaryButton } from "@/components/ui";
import { createOrganization, fetchMe } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/errors";
import { useOrg } from "@/lib/orgContext";
import { clearUserCache, useCurrentUser } from "@/lib/useCurrentUser";

function DashboardHome() {
  const router = useRouter();
  const search = useSearchParams();
  const alert = useAlert();
  const { user, loading, setUser } = useCurrentUser();
  const { activeMembership, setActiveOrgId } = useOrg();
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.get("newOrg") === "1") setShowCreateOrg(true);
  }, [search]);

  if (loading || !user) return <DashboardSkeleton />;

  const workspaces = user.memberships.length;

  async function onCreateOrg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = await createOrganization({
        name: orgName.trim(),
        slug: orgSlug.trim() || undefined,
      });
      try {
        localStorage.setItem("hirematch_active_org", org.id);
      } catch {
        /* ignore */
      }
      clearUserCache();
      const me = await fetchMe();
      setUser(me);
      setActiveOrgId(org.id);
      setShowCreateOrg(false);
      setOrgName("");
      setOrgSlug("");
      alert.success("Organization created. You are the org admin.", "Workspace ready");
      router.replace("/dashboard");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not create organization"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Overview"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin={user.is_platform_admin}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950 md:text-3xl">
            Welcome back, {user.full_name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {activeMembership
              ? `Working in ${activeMembership.organization_name}. Switch workspace from the top bar.`
              : "Multi-tenant SaaS: each organization keeps its own team and data."}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreateOrg(true)}>
          Create organization
        </button>
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
              <dt className="text-ink-500">Active org</dt>
              <dd className="font-semibold text-ink-900">
                {activeMembership?.organization_name || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Platform admin</dt>
              <dd className="font-semibold text-ink-900">{user.is_platform_admin ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Your organizations"
          action={<Link href="/dashboard/team" className="text-sm font-semibold text-brand-700">Team</Link>}
        >
          <ul className="space-y-3">
            {user.memberships.map((m) => {
              const active = m.organization_id === activeMembership?.organization_id;
              return (
                <li key={m.organization_id}>
                  <button
                    type="button"
                    onClick={() => setActiveOrgId(m.organization_id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-brand-400 bg-brand-50"
                        : "border-ink-100 bg-surface-muted hover:border-ink-200"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{m.organization_name}</p>
                      <p className="text-xs capitalize text-ink-500">{m.role.replaceAll("_", " ")}</p>
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
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Quick actions">
          <div className="space-y-3">
            <button type="button" className="btn-primary w-full" onClick={() => setShowCreateOrg(true)}>
              Create organization
            </button>
            <Link href="/dashboard/team" className="btn-ghost w-full">
              Team — invite & assign roles
            </Link>
            {user.is_platform_admin && (
              <Link href="/dashboard/admin/rbac" className="btn-ghost w-full">
                Access Control
              </Link>
            )}
            <Link href="/dashboard/settings" className="btn-ghost w-full">
              Profile settings
            </Link>
          </div>
        </Panel>
      </div>

      {showCreateOrg && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close"
            onClick={() => setShowCreateOrg(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-950">Create organization</h2>
                <p className="mt-1 text-sm text-ink-500">
                  New company workspace. You become org admin. Masters stay org-specific.
                </p>
              </div>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowCreateOrg(false)}>
                Close
              </button>
            </div>
            <form onSubmit={onCreateOrg} className="mt-5 space-y-3">
              <Field
                label="Organization name"
                required
                minLength={2}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Recruiting"
              />
              <Field
                label="Slug (optional)"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                placeholder="acme-recruiting"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateOrg(false)}>
                  Cancel
                </button>
                <PrimaryButton type="submit" disabled={busy} className="w-auto">
                  {busy ? "Creating…" : "Create"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardHome />
    </Suspense>
  );
}
