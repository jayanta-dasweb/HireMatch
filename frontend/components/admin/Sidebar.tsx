"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBriefcase,
  IconFile,
  IconHome,
  IconKey,
  IconSettings,
  IconShield,
  IconUsers,
} from "@/components/admin/icons";

type NavItem = {
  href: string;
  label: string;
  icon: typeof IconHome;
  soon?: boolean;
  adminOnly?: boolean;
};

const links: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: IconHome },
  { href: "/dashboard/resumes", label: "Resumes", icon: IconFile, soon: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: IconBriefcase, soon: true },
  { href: "/dashboard/team", label: "Team", icon: IconUsers },
  { href: "/dashboard/admin", label: "Platform Admin", icon: IconShield, adminOnly: true },
  { href: "/dashboard/admin/rbac", label: "Access Control", icon: IconKey, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
];

export function Sidebar({
  open,
  onClose,
  isPlatformAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  isPlatformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const visible = links.filter((item) => !item.adminOnly || isPlatformAdmin);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-ink-950/40 lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--sidebar)] text-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-display text-sm font-bold">
            HM
          </div>
          <div>
            <p className="font-display text-base font-bold tracking-tight">HireMatch</p>
            <p className="text-xs text-white/50">
              {isPlatformAdmin ? "Platform admin" : "Admin workspace"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Menu
          </p>
          {visible.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.soon ? "/dashboard" : item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white shadow-float"
                    : "text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 opacity-90" />
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                    soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
