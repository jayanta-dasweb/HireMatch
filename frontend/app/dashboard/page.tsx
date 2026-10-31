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
  const [busy, setBusy] = useState(false);
  const emptyOrgForm = {
    name: "",
    slug: "",
    legal_name: "",
    description: "",
    industry: "",
    company_size: "",
    website: "",
    contact_email: "",
    contact_phone: "",
    country: "",
    city: "",
    address_line: "",
  };
  const [orgForm, setOrgForm] = useState(emptyOrgForm);

  function patchOrgForm(key: keyof typeof emptyOrgForm, value: string) {
    setOrgForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (search.get("newOrg") === "1") setShowCreateOrg(true);
  }, [search]);

  if (loading || !user) return <DashboardSkeleton />;

  const workspaces = user.memberships.length;
  const orgRole = activeMembership?.role?.replaceAll("_", " ") || "—";

  async function onCreateOrg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const trim = (v: string) => v.trim() || undefined;
      const org = await createOrganization({
        name: orgForm.name.trim(),
        slug: trim(orgForm.slug),
        legal_name: trim(orgForm.legal_name),
        description: trim(orgForm.description),
        industry: trim(orgForm.industry),
        company_size: trim(orgForm.company_size),
        website: trim(orgForm.website),
        contact_email: trim(orgForm.contact_email),
        contact_phone: trim(orgForm.contact_phone),
        country: trim(orgForm.country),
        city: trim(orgForm.city),
        address_line: trim(orgForm.address_line),
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
      setOrgForm(emptyOrgForm);
      alert.success("Organization created. You are the org admin for that workspace.", "Workspace ready");
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950 md:text-3xl">
          Welcome back, {user.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {activeMembership
            ? `Active workspace: ${activeMembership.organization_name} · your role here: ${orgRole}`
            : "Pick or create a workspace to get started."}
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

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Your organizations"
          action={
            <button
              type="button"
              className="text-sm font-semibold text-brand-700"
              onClick={() => setShowCreateOrg(true)}
            >
              + New company
            </button>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            Click a row to switch workspace. Team and permissions apply only inside the active org.
          </p>
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
                      <p className="text-xs capitalize text-ink-500">
                        Org role: {m.role.replaceAll("_", " ")}
                      </p>
                    </div>
                    {m.is_personal ? (
                      <span className="rounded-lg bg-ink-100 px-2 py-1 text-[11px] font-semibold text-ink-600">
                        Personal
                      </span>
                    ) : (
                      <span className="rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                        Company
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Who can do what">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-ink-900">Platform admin</dt>
              <dd className="mt-1 text-ink-500">
                HireMatch operator only (you: {user.is_platform_admin ? "yes" : "no"}). Manages all accounts,
                orgs, and the permission catalog across the product. Not an org role.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-900">Organization admin / member</dt>
              <dd className="mt-1 text-ink-500">
                Role inside one company. Org admin can invite people and give them create/edit/delete
                permissions for <span className="font-medium text-ink-700">that org only</span> (Team page).
                Those rights never open another company&apos;s data.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-900">Special permissions</dt>
              <dd className="mt-1 text-ink-500">
                Extra grants on one user in one org (e.g. <code className="text-xs">org.edit</code>,{" "}
                <code className="text-xs">org.members.create</code>). Set from System console → Users →
                Roles &amp; permissions, or assign a role on Team.
              </dd>
            </div>
            <div className="rounded-xl border border-ink-100 bg-surface-muted px-3 py-3 text-xs text-ink-600">
              Team / profile / system tools live in the left menu only — not duplicated here.
            </div>
          </dl>
          <div className="mt-4">
            <Link href="/dashboard/settings" className="text-sm font-semibold text-brand-700">
              Edit my profile →
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
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-950">New company workspace</h2>
                <p className="mt-1 text-sm text-ink-500">
                  Creates a separate organization (tenant). You become its org admin. This is not the same as
                  editing your current workspace.
                </p>
              </div>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setShowCreateOrg(false)}>
                Close
              </button>
            </div>
            <form onSubmit={onCreateOrg} className="mt-5 space-y-5">
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Basics</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Display name"
                    required
                    minLength={2}
                    value={orgForm.name}
                    onChange={(e) => patchOrgForm("name", e.target.value)}
                    placeholder="Acme Recruiting"
                  />
                  <Field
                    label="Legal / registered name"
                    value={orgForm.legal_name}
                    onChange={(e) => patchOrgForm("legal_name", e.target.value)}
                    placeholder="Acme Recruiting Pvt Ltd"
                  />
                </div>
                <Field
                  label="URL slug (optional)"
                  value={orgForm.slug}
                  onChange={(e) => patchOrgForm("slug", e.target.value)}
                  placeholder="acme-recruiting"
                />
                <label className="block text-sm font-medium text-ink-700">
                  About the company
                  <textarea
                    className="admin-input mt-1 min-h-[88px] resize-y"
                    value={orgForm.description}
                    onChange={(e) => patchOrgForm("description", e.target.value)}
                    placeholder="What you hire for, markets you serve…"
                    maxLength={2000}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Industry"
                    value={orgForm.industry}
                    onChange={(e) => patchOrgForm("industry", e.target.value)}
                    placeholder="Staffing / IT / Healthcare"
                  />
                  <label className="block text-sm font-medium text-ink-700">
                    Company size
                    <select
                      className="admin-input mt-1"
                      value={orgForm.company_size}
                      onChange={(e) => patchOrgForm("company_size", e.target.value)}
                    >
                      <option value="">Select size</option>
                      <option value="1-10">1–10</option>
                      <option value="11-50">11–50</option>
                      <option value="51-200">51–200</option>
                      <option value="201-500">201–500</option>
                      <option value="501-1000">501–1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-3 border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Contact</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Website"
                    type="url"
                    value={orgForm.website}
                    onChange={(e) => patchOrgForm("website", e.target.value)}
                    placeholder="https://acme.example"
                  />
                  <Field
                    label="Contact email"
                    type="email"
                    value={orgForm.contact_email}
                    onChange={(e) => patchOrgForm("contact_email", e.target.value)}
                    placeholder="hr@acme.example"
                  />
                  <Field
                    label="Phone"
                    value={orgForm.contact_phone}
                    onChange={(e) => patchOrgForm("contact_phone", e.target.value)}
                    placeholder="+91 …"
                  />
                </div>
              </section>

              <section className="space-y-3 border-t border-ink-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Location</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Country"
                    value={orgForm.country}
                    onChange={(e) => patchOrgForm("country", e.target.value)}
                    placeholder="India"
                  />
                  <Field
                    label="City"
                    value={orgForm.city}
                    onChange={(e) => patchOrgForm("city", e.target.value)}
                    placeholder="Bengaluru"
                  />
                </div>
                <Field
                  label="Address"
                  value={orgForm.address_line}
                  onChange={(e) => patchOrgForm("address_line", e.target.value)}
                  placeholder="Street, area, postal code"
                />
              </section>

              <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
                <button type="button" className="btn-ghost" onClick={() => setShowCreateOrg(false)}>
                  Cancel
                </button>
                <PrimaryButton type="submit" disabled={busy} className="w-auto">
                  {busy ? "Creating…" : "Create organization"}
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
