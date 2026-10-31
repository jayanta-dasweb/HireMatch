"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { logoutUser } from "@/lib/api";
import { clearActiveOrg } from "@/lib/orgContext";
import { clearUserCache } from "@/lib/useCurrentUser";

export function AdminShell({
  title,
  userName,
  userEmail,
  isPlatformAdmin = false,
  children,
}: {
  title: string;
  userName: string;
  userEmail: string;
  isPlatformAdmin?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onLogout() {
    await logoutUser();
    clearUserCache();
    clearActiveOrg();
    router.push("/sign-in");
  }

  return (
    <div className="min-h-screen bg-surface-muted lg:flex">
      <Sidebar open={open} onClose={() => setOpen(false)} isPlatformAdmin={isPlatformAdmin} />
      <div className="min-w-0 flex-1">
        <Topbar
          title={title}
          userName={userName}
          userEmail={userEmail}
          onMenu={() => setOpen(true)}
          onLogout={onLogout}
        />
        <div className="animate-fade-up p-4 md:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
