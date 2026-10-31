"use client";

import { IconBell, IconLogout, IconMenu, IconSearch } from "@/components/admin/icons";

export function Topbar({
  title,
  userName,
  userEmail,
  onMenu,
  onLogout,
}: {
  title: string;
  userName: string;
  userEmail: string;
  onMenu: () => void;
  onLogout: () => void;
}) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-ink-100 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl border border-ink-200 p-2 text-ink-700 lg:hidden"
          aria-label="Open menu"
        >
          <IconMenu />
        </button>
        <div>
          <p className="font-display text-lg font-bold text-ink-950">{title}</p>
          <p className="hidden text-xs text-ink-500 sm:block">Recruitment intelligence console</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative hidden md:block">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="w-64 rounded-xl border border-ink-200 bg-surface-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            placeholder="Search workspace…"
            readOnly
          />
        </div>
        <button type="button" className="rounded-xl border border-ink-200 p-2 text-ink-600" aria-label="Notifications">
          <IconBell />
        </button>
        <div className="hidden items-center gap-3 rounded-2xl border border-ink-100 bg-surface-muted px-2.5 py-1.5 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-xs font-bold text-white">
            {initials || "U"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{userName}</p>
            <p className="truncate text-xs text-ink-500">{userEmail}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="btn-ghost gap-2 px-3 py-2">
          <IconLogout className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
