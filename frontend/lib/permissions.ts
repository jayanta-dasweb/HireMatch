import { Membership } from "@/lib/api";
import { useOrg } from "@/lib/orgContext";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Legacy codes still expand to granular CRUD for UI checks. */
const EXPAND: Record<string, string[]> = {
  "org.members.invite": ["org.members.create"],
  "org.members.manage": ["org.members.edit", "org.members.delete"],
  "org.roles.manage": ["org.roles.view", "org.roles.create", "org.roles.edit", "org.roles.delete"],
  "org.settings.manage": ["org.settings.view", "org.settings.edit"],
};

export function expandPermissions(codes: string[] | undefined | null): Set<string> {
  const out = new Set<string>(codes || []);
  for (const code of Array.from(out)) {
    for (const extra of EXPAND[code] || []) out.add(extra);
  }
  return out;
}

/** True if membership (or platform admin) has the permission. */
export function can(
  membership: Membership | null | undefined,
  code: string,
  opts?: { isPlatformAdmin?: boolean },
): boolean {
  if (opts?.isPlatformAdmin) return true;
  return expandPermissions(membership?.permissions).has(code);
}

export function canAny(
  membership: Membership | null | undefined,
  codes: string[],
  opts?: { isPlatformAdmin?: boolean },
): boolean {
  return codes.some((c) => can(membership, c, opts));
}

export function canAll(
  membership: Membership | null | undefined,
  codes: string[],
  opts?: { isPlatformAdmin?: boolean },
): boolean {
  return codes.every((c) => can(membership, c, opts));
}

/** Hook: check permission against the active organization membership. Empty code = always allowed. */
export function useCan(code: string): boolean {
  const { user } = useCurrentUser();
  const { activeMembership } = useOrg();
  if (!code) return true;
  return can(activeMembership, code, { isPlatformAdmin: user?.is_platform_admin });
}

export function useCanAny(codes: string[]): boolean {
  const { user } = useCurrentUser();
  const { activeMembership } = useOrg();
  return canAny(activeMembership, codes, { isPlatformAdmin: user?.is_platform_admin });
}
