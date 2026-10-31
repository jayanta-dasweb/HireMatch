const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "hirematch_tokens";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Membership = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
  is_personal: boolean;
};

export type UserMe = {
  id: string;
  email: string;
  full_name: string;
  headline: string | null;
  locale: string;
  is_email_verified: boolean;
  is_platform_admin: boolean;
  memberships: Membership[];
  created_at: string;
};

function readTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenPair) : null;
  } catch {
    return null;
  }
}

export function storeTokens(tokens: TokenPair | null) {
  if (typeof window === "undefined") return;
  if (!tokens) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function errorMessage(data: unknown): string {
  const detail = (data as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string; loc?: unknown[] }) => {
        const field = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1] || "") : "";
        const msg = d.msg || "Invalid value";
        if (field === "email") return msg;
        if (field === "password") return msg;
        return msg;
      })
      .join(" ");
  }
  return "Request failed";
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (auth) {
    const access = readTokens()?.access_token;
    if (!access) throw new Error("Not authenticated");
    headers.set("Authorization", `Bearer ${access}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) throw new Error(errorMessage(data));
  return data as T;
}

export const registerUser = (body: { email: string; password: string; full_name: string }) =>
  apiFetch<{ verification_token?: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });

export async function loginUser(body: { email: string; password: string }) {
  const tokens = await apiFetch<TokenPair>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  storeTokens(tokens);
  return tokens;
}

export async function logoutUser() {
  const tokens = readTokens();
  if (tokens?.refresh_token) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      }, true);
    } catch {
      /* always clear local session */
    }
  }
  storeTokens(null);
}

export const fetchMe = () => apiFetch<UserMe>("/users/me", {}, true);

export const verifyEmail = (token: string) =>
  apiFetch<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

/** Re-export admin helpers so older imports keep working. Prefer `@/lib/adminApi`. */
export {
  adminCreateUser,
  adminFetchAudit,
  adminFetchHealth,
  adminFetchOrgs,
  adminFetchUsers,
  adminResetPassword,
  adminSetOrgActive,
  adminSetUserActive,
  adminUpdateUser,
} from "@/lib/adminApi";
export type { AdminHealth, AdminOrg, AdminUser, AuditLog } from "@/lib/adminApi";
