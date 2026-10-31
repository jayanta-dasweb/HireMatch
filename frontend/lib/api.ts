const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

function getStoredTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("hirematch_tokens");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenPair;
  } catch {
    return null;
  }
}

export function storeTokens(tokens: TokenPair | null) {
  if (typeof window === "undefined") return;
  if (!tokens) {
    localStorage.removeItem("hirematch_tokens");
    return;
  }
  localStorage.setItem("hirematch_tokens", JSON.stringify(tokens));
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (auth) {
    const tokens = getStoredTokens();
    if (!tokens?.access_token) {
      throw new Error("Not authenticated");
    }
    headers.set("Authorization", `Bearer ${tokens.access_token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join(", ")
          : "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export async function registerUser(payload: {
  email: string;
  password: string;
  full_name: string;
}) {
  return apiFetch<{
    message: string;
    user_id: string;
    email: string;
    verification_token?: string;
    email_delivery: string;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  const tokens = await apiFetch<TokenPair>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  storeTokens(tokens);
  return tokens;
}

export async function logoutUser() {
  const tokens = getStoredTokens();
  if (tokens?.refresh_token && tokens.access_token) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      }, true);
    } catch {
      // still clear local session
    }
  }
  storeTokens(null);
}

export async function fetchMe() {
  return apiFetch<UserMe>("/users/me", {}, true);
}

export async function verifyEmail(token: string) {
  return apiFetch<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function healthCheck() {
  return apiFetch<{ status: string }>("/health");
}
