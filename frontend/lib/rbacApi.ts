import { apiFetch } from "@/lib/api";

export type RbacPermission = {
  id: string;
  code: string;
  name: string;
  group: string;
  description: string | null;
};

export type RbacRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: string[];
  created_at: string;
};

export type OrgMember = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  role_id: string | null;
  created_at: string;
};

export const fetchPermissions = () => apiFetch<RbacPermission[]>("/rbac/permissions", {}, true);

export const createPermission = (body: {
  code: string;
  name: string;
  group?: string;
  description?: string;
}) => apiFetch<RbacPermission>("/rbac/permissions", { method: "POST", body: JSON.stringify(body) }, true);

export const updatePermission = (
  id: string,
  body: { name?: string; group?: string; description?: string | null },
) =>
  apiFetch<RbacPermission>(`/rbac/permissions/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);

export const fetchRoles = (organizationId?: string, includeSystem = true) => {
  const q = new URLSearchParams();
  if (organizationId) q.set("organization_id", organizationId);
  q.set("include_system", String(includeSystem));
  const suffix = q.toString() ? `?${q}` : "";
  return apiFetch<RbacRole[]>(`/rbac/roles${suffix}`, {}, true);
};

export const createRole = (body: {
  slug: string;
  name: string;
  description?: string;
  organization_id?: string | null;
  is_system?: boolean;
  permission_codes?: string[];
}) => apiFetch<RbacRole>("/rbac/roles", { method: "POST", body: JSON.stringify(body) }, true);

export const updateRole = (
  id: string,
  body: {
    name?: string;
    description?: string | null;
    is_active?: boolean;
    permission_codes?: string[];
  },
) => apiFetch<RbacRole>(`/rbac/roles/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);

export const fetchOrgMembers = (orgId: string) =>
  apiFetch<OrgMember[]>(`/organizations/${orgId}/members`, {}, true);

export const inviteOrgMember = (
  orgId: string,
  body: { email: string; role_slug?: string; role_id?: string },
) =>
  apiFetch<{ id: string; email: string; role: string; invite_token?: string | null }>(
    `/organizations/${orgId}/invitations`,
    { method: "POST", body: JSON.stringify(body) },
    true,
  );

export const assignMemberRole = (
  orgId: string,
  userId: string,
  body: { role_id?: string; role_slug?: string },
) =>
  apiFetch<OrgMember>(
    `/rbac/organizations/${orgId}/members/${userId}/role`,
    { method: "PATCH", body: JSON.stringify(body) },
    true,
  );
