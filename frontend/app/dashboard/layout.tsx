"use client";

import { ReactNode } from "react";
import { OrgProvider } from "@/lib/orgContext";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Shared tenant context for all dashboard pages (active organization). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  return <OrgProvider memberships={user?.memberships || []}>{children}</OrgProvider>;
}
