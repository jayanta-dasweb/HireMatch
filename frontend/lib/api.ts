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
  role_id?: string | null;
  is_personal: boolean;
  permissions?: string[];
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

let refreshInFlight: Promise<boolean> | null = null;

/** Exchange refresh token for a new pair. Returns false if session is dead. */
export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = readTokens()?.refresh_token;
    if (!refresh) return false;
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        storeTokens(null);
        return false;
      }
      storeTokens(data as TokenPair);
      return true;
    } catch {
      storeTokens(null);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
  _retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (auth) {
    const access = readTokens()?.access_token;
    if (!access) throw new Error("Not authenticated");
    headers.set("Authorization", `Bearer ${access}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.status === 401 && auth && !_retried) {
    const ok = await refreshSession();
    if (ok) return apiFetch<T>(path, options, auth, true);
    storeTokens(null);
    throw new Error("Not authenticated");
  }

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
      await apiFetch(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: tokens.refresh_token }),
        },
        true,
      );
    } catch {
      /* always clear local session */
    }
  }
  storeTokens(null);
}

let meInFlight: Promise<UserMe> | null = null;

/** Deduped /users/me — layout + pages share one request. */
export function fetchMe(): Promise<UserMe> {
  if (!meInFlight) {
    meInFlight = apiFetch<UserMe>("/users/me", {}, true).finally(() => {
      meInFlight = null;
    });
  }
  return meInFlight;
}

export type OrganizationOut = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  is_active: boolean;
  legal_name?: string | null;
  description?: string | null;
  industry?: string | null;
  company_size?: string | null;
  website?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  country?: string | null;
  city?: string | null;
  address_line?: string | null;
  created_at: string;
};

export type OrganizationCreateBody = {
  name: string;
  slug?: string;
  legal_name?: string;
  description?: string;
  industry?: string;
  company_size?: string;
  website?: string;
  contact_email?: string;
  contact_phone?: string;
  country?: string;
  city?: string;
  address_line?: string;
};

export function createOrganization(body: OrganizationCreateBody) {
  return apiFetch<OrganizationOut>("/organizations", { method: "POST", body: JSON.stringify(body) }, true);
}

export function acceptOrganizationInvite(orgId: string, token: string) {
  return apiFetch<{ user_id: string; email: string; full_name: string; role: string }>(
    `/organizations/${orgId}/invitations/accept`,
    { method: "POST", body: JSON.stringify({ token }) },
    true,
  );
}

export const verifyEmail = (token: string) =>
  apiFetch<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

/** True when a local access token exists (may still be expired). */
export function hasAccessToken(): boolean {
  return !!readTokens()?.access_token;
}

export function hasRefreshToken(): boolean {
  return !!readTokens()?.refresh_token;
}
