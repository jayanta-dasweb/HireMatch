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

export type AdminMembership = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
  role_id: string | null;
  is_personal: boolean;
  is_active: boolean;
  role_permissions: string[];
  special_permissions: string[];
  effective_permissions: string[];
};

export type AdminUserDetail = AdminUser & {
  memberships: AdminMembership[];
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

export function adminFetchUser(id: string) {
  return apiFetch<AdminUserDetail>(`/admin/users/${id}`, {}, true);
}

export function adminAssignUserOrgRole(
  userId: string,
  orgId: string,
  body: { role_id?: string; role_slug?: string },
) {
  return apiFetch<AdminUserDetail>(
    `/admin/users/${userId}/organizations/${orgId}/role`,
    { method: "PATCH", body: JSON.stringify(body) },
    true,
  );
}

export function adminSetSpecialPermissions(userId: string, orgId: string, permission_codes: string[]) {
  return apiFetch<AdminUserDetail>(
    `/admin/users/${userId}/organizations/${orgId}/special-permissions`,
    { method: "PUT", body: JSON.stringify({ permission_codes }) },
    true,
  );
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
