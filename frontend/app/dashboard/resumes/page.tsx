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
  ResumeExtraction,
  StructuredPayload,
  deleteResume,
  downloadResume,
  getResume,
  getResumeExtraction,
  listResumes,
  saveResumeExtractionReview,
  updateResumeTitle,
  uploadResume,
} from "@/lib/resumesApi";
import { useCurrentUser } from "@/lib/useCurrentUser";

function statusTone(status: string) {
  if (status === "ready" || status === "reviewed") return "bg-brand-50 text-brand-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  return "bg-ink-100 text-ink-600";
}

function emptyPayload(): StructuredPayload {
  return {
    extractor: "local_v1",
    contact: { emails: [], phones: [], links: [], linkedin: [], github: [] },
    skills: [],
    experience_sections: [],
    education_sections: [],
  };
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
  const [extraction, setExtraction] = useState<ResumeExtraction | null>(null);
  const [draft, setDraft] = useState<StructuredPayload>(emptyPayload());
  const [skillsText, setSkillsText] = useState("");

  const orgId = activeOrgId || "";

  async function reload() {
    if (!orgId || !canView) {
      setItems([]);
      return;
    }
    const rows = await listResumes(orgId);
    setItems(rows);
  }

  async function loadExtraction(docId: string) {
    try {
      const row = await getResumeExtraction(orgId, docId);
      setExtraction(row);
      const eff = row.effective_payload || emptyPayload();
      setDraft({
        ...emptyPayload(),
        ...eff,
        contact: { ...emptyPayload().contact, ...(eff.contact || {}) },
      });
      setSkillsText((eff.skills || []).join(", "));
    } catch {
      setExtraction(null);
      setDraft(emptyPayload());
      setSkillsText("");
    }
  }

  useEffect(() => {
    if (!user || !orgId) return;
    reload().catch((err) => alert.error(friendlyErrorMessage(err, "Failed to load resumes")));
  }, [user, orgId, canView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!orgId || !canView) return;
    const processing = items.some((r) => r.status === "processing" || r.status === "uploaded");
    const selectedProcessing =
      selected && (selected.status === "processing" || selected.status === "uploaded");
    if (!processing && !selectedProcessing) return;

    let ticks = 0;
    const maxTicks = 30;
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
            if (detail.status === "ready") await loadExtraction(detail.id);
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
      alert.success("Resume uploaded. Extraction runs in the background.", "Uploaded");
      await reload();
      if (doc?.id) {
        const detail = await getResume(orgId, doc.id);
        setSelected(detail);
        setEditTitle(detail.title);
        if (detail.status === "ready") await loadExtraction(detail.id);
        else {
          setExtraction(null);
          setDraft(emptyPayload());
          setSkillsText("");
        }
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
      if (detail.status === "ready" || detail.status === "failed") await loadExtraction(id);
      else {
        setExtraction(null);
        setDraft(emptyPayload());
        setSkillsText("");
      }
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

  async function onSaveReview() {
    if (!orgId || !selected || !canEdit || !extraction) return;
    setBusy(true);
    try {
      const payload: StructuredPayload = {
        ...draft,
        skills: skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        contact: {
          emails: draft.contact?.emails || [],
          phones: draft.contact?.phones || [],
          links: draft.contact?.links || [],
          linkedin: draft.contact?.linkedin || [],
          github: draft.contact?.github || [],
        },
      };
      const saved = await saveResumeExtractionReview(orgId, selected.id, payload);
      setExtraction(saved);
      setDraft(saved.effective_payload);
      setSkillsText((saved.effective_payload.skills || []).join(", "));
      alert.success("Review saved.", "Saved");
    } catch (err) {
      alert.error(friendlyErrorMessage(err, "Could not save review"));
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
      if (selected?.id === id) {
        setSelected(null);
        setExtraction(null);
      }
      await reload();
      alert.success("Resume removed.", "Deleted");
    } catch (err) {
      alert.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <DashboardSkeleton />;

  const contact = draft.contact || {};
  const hasStructure =
    (contact.emails && contact.emails.length > 0) ||
    (contact.phones && contact.phones.length > 0) ||
    (contact.links && contact.links.length > 0) ||
    (draft.skills && draft.skills.length > 0) ||
    skillsText.trim().length > 0 ||
    (draft.experience_sections && draft.experience_sections.length > 0) ||
    (draft.education_sections && draft.education_sections.length > 0);

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
            ? `Workspace: ${activeMembership.organization_name}. Plain text + free local structure — only what appears in the file.`
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

          <div className="space-y-4 xl:col-span-3">
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
                      Processing — scanning and extracting. This page refreshes automatically.
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
                    <pre className="max-h-[16rem] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-100 bg-surface-muted p-3 text-xs text-ink-800">
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

            {selected && (
              <Panel title="In-house analysis">
                <p className="mb-3 text-sm text-ink-500">
                  HireMatch local engine (free, no external AI APIs) — evidence from your file only. Review and edit
                  below.
                  {extraction ? (
                    <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 bg-ink-100">
                      {extraction.status} · {extraction.extractor}
                    </span>
                  ) : null}
                </p>

                {!extraction && selected.status === "ready" && (
                  <p className="text-sm text-ink-400">No analysis yet — re-upload to run the local engine.</p>
                )}
                {!extraction && (selected.status === "processing" || selected.status === "uploaded") && (
                  <p className="text-sm text-ink-400">Waiting for analysis…</p>
                )}

                {extraction?.error && (
                  <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {extraction.error}
                  </p>
                )}

                {extraction && draft.ats && (
                  <div className="mb-4 rounded-xl border border-ink-100 bg-surface-muted p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">ATS-style score</p>
                    <p className="mt-1 font-display text-3xl font-bold text-ink-950">
                      {draft.ats.score ?? 0}
                      <span className="text-base font-medium text-ink-500">/100</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {draft.ats.passed}/{draft.ats.total} checks · {draft.metrics?.word_count ?? 0} words · ~
                      {draft.metrics?.estimated_pages ?? "?"} pages
                    </p>
                    <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                      {(draft.ats.checks || []).map((c) => (
                        <li key={c.id} className="text-xs text-ink-700">
                          <span className={c.pass ? "text-brand-700" : "text-rose-600"}>
                            {c.pass ? "Pass" : "Miss"}
                          </span>{" "}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {extraction && (draft.findings || []).length > 0 && (
                  <ul className="mb-4 space-y-2">
                    {(draft.findings || []).map((f) => (
                      <li
                        key={f.code + f.message.slice(0, 24)}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          f.severity === "gap"
                            ? "border-rose-200 bg-rose-50 text-rose-900"
                            : f.severity === "strength"
                              ? "border-brand-200 bg-brand-50 text-brand-900"
                              : "border-ink-100 bg-white text-ink-700"
                        }`}
                      >
                        {f.message}
                      </li>
                    ))}
                  </ul>
                )}

                {extraction && (draft.roles || []).length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Parsed roles</p>
                    <ul className="space-y-3">
                      {(draft.roles || []).map((r, idx) => (
                        <li key={idx} className="rounded-xl border border-ink-100 p-3 text-sm">
                          <p className="font-semibold text-ink-900">
                            {r.title || "Role"}
                            {r.company ? ` · ${r.company}` : ""}
                          </p>
                          {r.dates && (
                            <p className="text-xs text-ink-500">
                              {r.dates.start} – {r.dates.end}
                            </p>
                          )}
                          {(r.bullets || []).length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-700">
                              {(r.bullets || []).slice(0, 6).map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {extraction && (draft.education_entries || []).length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Education</p>
                    <ul className="space-y-2">
                      {(draft.education_entries || []).map((e, idx) => (
                        <li key={idx} className="text-sm text-ink-800">
                          <span className="font-medium">{e.degree || e.school}</span>
                          {e.degree && e.school ? ` · ${e.school}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {extraction && !hasStructure && extraction.status !== "failed" && !(draft.findings || []).length && (
                  <p className="mb-3 text-sm text-ink-400">Nothing found in text for contact/skills/sections.</p>
                )}

                {extraction && (
                  <div className="space-y-3 border-t border-ink-50 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Editable review</p>
                    <Field
                      label="Emails (comma-separated)"
                      value={(contact.emails || []).join(", ")}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          contact: {
                            ...contact,
                            emails: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                    <Field
                      label="Phones (comma-separated)"
                      value={(contact.phones || []).join(", ")}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          contact: {
                            ...contact,
                            phones: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                    />
                    <Field
                      label="Skills (comma-separated)"
                      value={skillsText}
                      disabled={!canEdit}
                      onChange={(e) => setSkillsText(e.target.value)}
                    />
                    <label className="block text-sm font-medium text-ink-700">
                      Experience sections (raw)
                      <textarea
                        className="admin-input mt-1 min-h-[6rem]"
                        disabled={!canEdit}
                        value={(draft.experience_sections || []).join("\n\n---\n\n")}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            experience_sections: e.target.value
                              .split(/\n\n---\n\n/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium text-ink-700">
                      Education sections (raw)
                      <textarea
                        className="admin-input mt-1 min-h-[5rem]"
                        disabled={!canEdit}
                        value={(draft.education_sections || []).join("\n\n---\n\n")}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            education_sections: e.target.value
                              .split(/\n\n---\n\n/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </label>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-xs"
                        disabled={busy}
                        onClick={() => onSaveReview()}
                      >
                        Save review
                      </button>
                    )}
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
