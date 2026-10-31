import { apiFetch } from "@/lib/api";

export type ActorInfo = {
  id: string | null;
  email: string | null;
  full_name: string | null;
};

export type RbacPermissionGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: ActorInfo | null;
  updated_by: ActorInfo | null;
};

export type RbacPermission = {
  id: string;
  code: string;
  name: string;
  group: string;
  group_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: ActorInfo | null;
  updated_by: ActorInfo | null;
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
  updated_at: string;
  created_by: ActorInfo | null;
  updated_by: ActorInfo | null;
};

export type PageMeta = {
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type PermissionPage = { items: RbacPermission[]; meta: PageMeta };
export type RolePage = { items: RbacRole[]; meta: PageMeta };
export type PermissionGroupPage = { items: RbacPermissionGroup[]; meta: PageMeta };

export type RbacAuditItem = {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  actor: ActorInfo | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type RbacAuditPage = { items: RbacAuditItem[]; meta: PageMeta };

export type OrgMember = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  role_id: string | null;
  created_at: string;
};

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const fetchPermissions = (params: {
  q?: string;
  group?: string;
  is_active?: boolean | "";
  page?: number;
  page_size?: number;
} = {}) => apiFetch<PermissionPage>(`/rbac/permissions${qs(params)}`, {}, true);

export const fetchPermissionGroups = () => apiFetch<string[]>("/rbac/permission-groups", {}, true);

export const fetchGroupMasters = (params: {
  q?: string;
  is_active?: boolean | "";
  page?: number;
  page_size?: number;
} = {}) => apiFetch<PermissionGroupPage>(`/rbac/groups${qs(params)}`, {}, true);

export const createGroupMaster = (body: {
  slug: string;
  name: string;
  description?: string;
  is_active?: boolean;
}) => apiFetch<RbacPermissionGroup>("/rbac/groups", { method: "POST", body: JSON.stringify(body) }, true);

export const updateGroupMaster = (
  id: string,
  body: { name?: string; description?: string | null; is_active?: boolean },
) => apiFetch<RbacPermissionGroup>(`/rbac/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);

export const createPermission = (body: {
  code: string;
  name: string;
  group?: string;
  group_id?: string;
  description?: string;
  is_active?: boolean;
}) => apiFetch<RbacPermission>("/rbac/permissions", { method: "POST", body: JSON.stringify(body) }, true);

export const updatePermission = (
  id: string,
  body: { name?: string; group?: string; description?: string | null; is_active?: boolean },
) =>
  apiFetch<RbacPermission>(`/rbac/permissions/${id}`, { method: "PATCH", body: JSON.stringify(body) }, true);

export const fetchRoles = (params: {
  organization_id?: string;
  include_system?: boolean;
  q?: string;
  is_active?: boolean | "";
  page?: number;
  page_size?: number;
} = {}) => apiFetch<RolePage>(`/rbac/roles${qs(params)}`, {}, true);

export const createRole = (body: {
  slug: string;
  name: string;
  description?: string;
  organization_id?: string | null;
  is_system?: boolean;
  is_active?: boolean;
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

export const fetchRbacAudit = (params: { q?: string; page?: number; page_size?: number } = {}) =>
  apiFetch<RbacAuditPage>(`/rbac/audit${qs(params)}`, {}, true);

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

export function actorLabel(actor: ActorInfo | null | undefined) {
  if (!actor) return "System";
  return actor.full_name || actor.email || "Unknown";
}
