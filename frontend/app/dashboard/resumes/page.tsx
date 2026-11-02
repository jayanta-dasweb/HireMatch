"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/StatCard";
import { DashboardSkeleton } from "@/components/Loading";
import { useAlert } from "@/components/AlertModal";
import { Field, PrimaryButton } from "@/components/ui";
import { friendlyErrorMessage } from "@/lib/errors";
import { useOrg } from "@/lib/orgContext";
import { useCan } from "@/lib/permissions";
import {
  ResumeDocument,
  ResumeDocumentDetail,
  deleteResume,
  downloadResume,
  getResume,
  listResumes,
  updateResumeTitle,
  uploadResume,
} from "@/lib/resumesApi";
import { useCurrentUser } from "@/lib/useCurrentUser";

function statusTone(status: string) {
  if (status === "ready") return "bg-brand-50 text-brand-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  return "bg-ink-100 text-ink-600";
}

export default function ResumesPage() {
  const alert = useAlert();
  const { user, loading } = useCurrentUser();
  const { activeOrgId, activeMembership } = useOrg();
  const canView = useCan("resumes.view");
  const canCreate = useCan("resumes.create");
  const canEdit = useCan("resumes.edit");
  const canDelete = useCan("resumes.delete");

  const [items, setItems] = useState<ResumeDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<ResumeDocumentDetail | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const orgId = activeOrgId || "";

  async function reload() {
    if (!orgId || !canView) {
      setItems([]);
      return;
    }
    const rows = await listResumes(orgId);
    setItems(rows);
  }

  useEffect(() => {
    if (!user || !orgId) return;
    reload().catch((err) => alert.error(friendlyErrorMessage(err, "Failed to load resumes")));
  }, [user, orgId, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while Celery is still extracting text
  useEffect(() => {
    if (!orgId || !canView) return;
    const processing = items.some((r) => r.status === "processing" || r.status === "uploaded");
    const selectedProcessing =
      selected && (selected.status === "processing" || selected.status === "uploaded");
    if (!processing && !selectedProcessing) return;

    let ticks = 0;
    const maxTicks = 30; // ~60s at 2s
    const id = window.setInterval(() => {
      ticks += 1;
      if (ticks > maxTicks) {
        window.clearInterval(id);
        return;
      }
      reload()
        .then(async () => {
          if (selected?.id) {
            const detail = await getResume(orgId, selected.id);
            setSelected(detail);
            setEditTitle(detail.title);
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [items, selected?.id, selected?.status, orgId, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !file) return;
    setBusy(true);
    try {
      const doc = await uploadResume(orgId, file, title || undefined);
      setFile(null);
      setTitle("");
      alert.success("Resume uploaded. Text extraction runs in the background.", "Uploaded");
      await reload();
      if (doc?.id) {
        const detail = await getResume(orgId, doc.id);
        setSelected(detail);
        setEditTitle(detail.title);
      }
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    if (!orgId) return;
    setBusy(true);
    try {
      const detail = await getResume(orgId, id);
      setSelected(detail);
      setEditTitle(detail.title);
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not open resume"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveTitle() {
    if (!orgId || !selected || !canEdit) return;
    setBusy(true);
    try {
      const updated = await updateResumeTitle(orgId, selected.id, editTitle.trim());
      setSelected({ ...selected, title: updated.title });
      await reload();
      alert.success("Title updated.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!orgId || !canDelete) return;
    if (!window.confirm("Remove this resume from the workspace?")) return;
    setBusy(true);
    try {
      await deleteResume(orgId, id);
      if (selected?.id === id) setSelected(null);
      await reload();
      alert.success("Resume removed.", "Deleted");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;

  return (
    <AdminShell
      title="Resumes"
      userName={user.full_name}
      userEmail={user.email}
      isPlatformAdmin={user.is_platform_admin}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Resumes</h1>
        <p className="mt-1 text-sm text-ink-500">
          {activeMembership
            ? `Workspace: ${activeMembership.organization_name}. Upload PDF or DOCX — we extract plain text only (no invented AI fields).`
            : "Select a workspace from the top bar."}
        </p>
      </div>

      {!canView ? (
        <Panel title="No access">
          <p className="text-sm text-ink-500">
            You need <code className="text-xs">resumes.view</code> in this organization to see resumes.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-2">
            {canCreate && (
              <Panel title="Upload resume">
                <form onSubmit={onUpload} className="space-y-3">
                  <Field
                    label="Title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Defaults to filename"
                  />
                  <label className="block text-sm font-medium text-ink-700">
                    File (PDF or DOCX, max 10MB)
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="admin-input mt-1"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                    />
                  </label>
                  <PrimaryButton type="submit" disabled={busy || !file || !orgId}>
                    {busy ? "Uploading…" : "Upload"}
                  </PrimaryButton>
                </form>
              </Panel>
            )}

            <Panel title={`Library (${items.length})`}>
              <ul className="divide-y divide-ink-50">
                {items.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openDetail(r.id)}
                    >
                      <p className="truncate text-sm font-semibold text-ink-900">{r.title}</p>
                      <p className="truncate text-xs text-ink-500">{r.original_filename}</p>
                      <span
                        className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs text-rose-700"
                        disabled={busy}
                        onClick={() => onDelete(r.id)}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="py-4 text-sm text-ink-400">No resumes in this workspace yet.</li>
                )}
              </ul>
            </Panel>
          </div>

          <div className="xl:col-span-3">
            <Panel title={selected ? selected.title : "Details"}>
              {!selected ? (
                <p className="text-sm text-ink-400">Select a resume to preview extracted text.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${statusTone(selected.status)}`}
                    >
                      {selected.status}
                    </span>
                    <span className="text-xs text-ink-500">{selected.content_type}</span>
                    <button
                      type="button"
                      className="btn-ghost ml-auto px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() =>
                        downloadResume(orgId, selected.id, selected.original_filename).catch((err) =>
                          alert.error(friendlyErrorMessage(err, "Download failed")),
                        )
                      }
                    >
                      Download file
                    </button>
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Field
                          label="Title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-xs"
                        disabled={busy}
                        onClick={() => onSaveTitle()}
                      >
                        Save title
                      </button>
                    </div>
                  )}

                  {(selected.status === "processing" || selected.status === "uploaded") && (
                    <p className="rounded-xl border border-ink-100 bg-surface-muted px-3 py-2 text-sm text-ink-600">
                      Processing — scanning and extracting plain text. This page refreshes automatically.
                    </p>
                  )}

                  {selected.latest_version?.parse_error && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                      Parse issue: {selected.latest_version.parse_error}
                    </p>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                      Extracted text
                    </p>
                    <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-100 bg-surface-muted p-3 text-xs text-ink-800">
                      {selected.latest_version?.extracted_text ||
                        selected.versions?.[selected.versions.length - 1]?.extracted_text ||
                        (selected.status === "processing" || selected.status === "uploaded"
                          ? "(Waiting for extraction…)"
                          : "(No text extracted)")}
                    </pre>
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
