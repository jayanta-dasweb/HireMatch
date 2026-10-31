"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Membership } from "@/lib/api";

const STORAGE_KEY = "hirematch_active_org";

type OrgContextValue = {
  memberships: Membership[];
  activeOrgId: string | null;
  activeMembership: Membership | null;
  setActiveOrgId: (organizationId: string) => void;
  hasMultipleOrgs: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!id) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearActiveOrg() {
  writeStoredOrgId(null);
}

export function OrgProvider({
  memberships,
  children,
}: {
  memberships: Membership[];
  children: ReactNode;
}) {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!memberships.length) {
      setActiveOrgIdState(null);
      return;
    }
    const stored = readStoredOrgId();
    const stillValid = stored && memberships.some((m) => m.organization_id === stored);
    const next = stillValid ? stored! : memberships[0].organization_id;
    setActiveOrgIdState(next);
    writeStoredOrgId(next);
  }, [memberships]);

  const setActiveOrgId = useCallback(
    (organizationId: string) => {
      if (!memberships.some((m) => m.organization_id === organizationId)) return;
      setActiveOrgIdState(organizationId);
      writeStoredOrgId(organizationId);
    },
    [memberships],
  );

  const activeMembership = useMemo(
    () => memberships.find((m) => m.organization_id === activeOrgId) || null,
    [memberships, activeOrgId],
  );

  const value = useMemo(
    () => ({
      memberships,
      activeOrgId,
      activeMembership,
      setActiveOrgId,
      hasMultipleOrgs: memberships.length > 1,
    }),
    [memberships, activeOrgId, activeMembership, setActiveOrgId],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    return {
      memberships: [] as Membership[],
      activeOrgId: null as string | null,
      activeMembership: null as Membership | null,
      setActiveOrgId: (_id: string) => {},
      hasMultipleOrgs: false,
    };
  }
  return ctx;
}
