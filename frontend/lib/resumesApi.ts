import { apiFetch, storeTokens } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "hirematch_tokens";

export type ResumeStatus = "uploaded" | "processing" | "ready" | "failed";

export type ResumeVersion = {
  id: string;
  version_number: number;
  byte_size: number;
  sha256: string;
  extracted_text: string | null;
  parse_error: string | null;
  created_at: string;
};

export type ResumeDocument = {
  id: string;
  organization_id: string;
  uploaded_by_user_id: string | null;
  title: string;
  original_filename: string;
  content_type: string;
  status: ResumeStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_version: ResumeVersion | null;
};

export type ResumeDocumentDetail = ResumeDocument & {
  versions: ResumeVersion[];
};

export type ExtractionStatus = "pending" | "ready" | "failed" | "reviewed";

export type StructuredPayload = {
  extractor?: string;
  contact?: {
    emails?: string[];
    phones?: string[];
    links?: string[];
    linkedin?: string[];
    github?: string[];
  };
  skills?: string[];
  experience_sections?: string[];
  education_sections?: string[];
};

export type ResumeExtraction = {
  id: string;
  document_id: string;
  version_id: string;
  organization_id: string;
  status: ExtractionStatus;
  payload: StructuredPayload;
  reviewed_payload: StructuredPayload | null;
  effective_payload: StructuredPayload;
  extractor: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function authHeader(): HeadersInit {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const tokens = raw ? (JSON.parse(raw) as { access_token?: string }) : null;
    if (!tokens?.access_token) throw new Error("Not authenticated");
    return { Authorization: `Bearer ${tokens.access_token}` };
  } catch {
    throw new Error("Not authenticated");
  }
}

export function listResumes(orgId: string) {
  return apiFetch<ResumeDocument[]>(`/organizations/${orgId}/resumes`, {}, true);
}

export function getResume(orgId: string, id: string) {
  return apiFetch<ResumeDocumentDetail>(`/organizations/${orgId}/resumes/${id}`, {}, true);
}

export function updateResumeTitle(orgId: string, id: string, title: string) {
  return apiFetch<ResumeDocument>(
    `/organizations/${orgId}/resumes/${id}`,
    { method: "PATCH", body: JSON.stringify({ title }) },
    true,
  );
}

export function deleteResume(orgId: string, id: string) {
  return apiFetch<void>(`/organizations/${orgId}/resumes/${id}`, { method: "DELETE" }, true);
}

/** Multipart upload — uses fetch directly (not JSON apiFetch). */
export async function uploadResume(orgId: string, file: File, title?: string): Promise<ResumeDocument> {
  const { ensureAccessToken } = await import("@/lib/api");
  const ready = await ensureAccessToken();
  if (!ready) {
    storeTokens(null);
    throw new Error("Not authenticated");
  }

  const body = new FormData();
  body.append("file", file);
  if (title?.trim()) body.append("title", title.trim());

  let response: Response;
  try {
    response = await fetch(`${API_URL}/organizations/${orgId}/resumes`, {
      method: "POST",
      headers: authHeader(),
      body,
    });
  } catch {
    throw new Error("Could not reach the API. Is the backend running?");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (data as { detail?: string | { msg?: string }[] })?.detail;
    if (typeof detail === "string") throw new Error(detail);
    throw new Error(`Upload failed (${response.status})`);
  }
  return data as ResumeDocument;
}

export function getResumeExtraction(orgId: string, id: string) {
  return apiFetch<ResumeExtraction>(`/organizations/${orgId}/resumes/${id}/extraction`, {}, true);
}

export function saveResumeExtractionReview(orgId: string, id: string, reviewed_payload: StructuredPayload) {
  return apiFetch<ResumeExtraction>(
    `/organizations/${orgId}/resumes/${id}/extraction`,
    { method: "PATCH", body: JSON.stringify({ reviewed_payload }) },
    true,
  );
}

export async function downloadResume(orgId: string, id: string, filename: string) {
  const { ensureAccessToken } = await import("@/lib/api");
  const ready = await ensureAccessToken();
  if (!ready) {
    storeTokens(null);
    throw new Error("Not authenticated");
  }
  const response = await fetch(`${API_URL}/organizations/${orgId}/resumes/${id}/download`, {
    headers: authHeader(),
  });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
