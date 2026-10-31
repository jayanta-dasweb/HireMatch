import { apiFetch } from "@/lib/api";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_platform_admin: boolean;
  membership_count: number;
};

export type AdminOrg = {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  is_active: boolean;
  created_at: string;
};

export type AdminHealth = {
  status: string;
  database: string;
  organization_count: number;
  user_count: number;
  active_user_count: number;
};

export type AuditLog = {
  id: string;
  action: string;
  actor_user_id: string | null;
  organization_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
};

export function adminFetchHealth() {
  return apiFetch<AdminHealth>("/admin/system-health", {}, true);
}

export function adminFetchUsers() {
  return apiFetch<AdminUser[]>("/admin/users", {}, true);
}

export function adminFetchOrgs() {
  return apiFetch<AdminOrg[]>("/admin/organizations", {}, true);
}

export function adminFetchAudit(limit = 100) {
  return apiFetch<AuditLog[]>(`/admin/audit-logs?limit=${limit}`, {}, true);
}

export function adminCreateUser(body: {
  email: string;
  full_name: string;
  password: string;
  is_platform_admin?: boolean;
  is_email_verified?: boolean;
  is_active?: boolean;
}) {
  return apiFetch<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(body) }, true);
}

export function adminUpdateUser(
  id: string,
  body: {
    full_name?: string;
    is_active?: boolean;
    is_email_verified?: boolean;
    is_platform_admin?: boolean;
  },
) {
  return apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);
}

export function adminSetUserActive(id: string, is_active: boolean) {
  return apiFetch<AdminUser>(
    `/admin/users/${id}/active`,
    { method: "PATCH", body: JSON.stringify({ is_active }) },
    true,
  );
}

export function adminResetPassword(id: string, new_password: string) {
  return apiFetch<AdminUser>(
    `/admin/users/${id}/reset-password`,
    { method: "POST", body: JSON.stringify({ new_password }) },
    true,
  );
}

export function adminSetOrgActive(id: string, is_active: boolean) {
  return apiFetch<AdminOrg>(
    `/admin/organizations/${id}/active`,
    { method: "PATCH", body: JSON.stringify({ is_active }) },
    true,
  );
}
