"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconBell, IconLogout, IconMenu, IconSearch } from "@/components/admin/icons";
import { useOrg } from "@/lib/orgContext";

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
  const { memberships, activeOrgId, activeMembership, setActiveOrgId, hasMultipleOrgs } = useOrg();
  const [orgOpen, setOrgOpen] = useState(false);
  const orgRef = useRef<HTMLDivElement>(null);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!orgOpen) return;
    function onDoc(e: MouseEvent) {
      if (!orgRef.current?.contains(e.target as Node)) setOrgOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [orgOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-ink-100 bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-xl border border-ink-200 p-2 text-ink-700 lg:hidden"
          aria-label="Open menu"
        >
          <IconMenu />
        </button>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink-950">{title}</p>
          <p className="hidden truncate text-xs text-ink-500 sm:block">
            {activeMembership
              ? `${activeMembership.organization_name} · ${activeMembership.role.replaceAll("_", " ")}`
              : "Recruitment intelligence console"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {memberships.length > 0 && (
          <div ref={orgRef} className="relative">
            <button
              type="button"
              onClick={() => setOrgOpen((o) => !o)}
              className="flex max-w-[200px] items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-left text-sm font-semibold text-ink-800 hover:border-brand-300 md:max-w-[260px]"
              aria-haspopup="listbox"
              aria-expanded={orgOpen}
            >
              <span className="truncate">
                {activeMembership?.organization_name || "Select workspace"}
              </span>
              <svg className="h-3.5 w-3.5 shrink-0 text-ink-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M5.25 7.5 10 12.25 14.75 7.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            </button>
            {orgOpen && (
              <div className="absolute right-0 z-[9200] mt-1 w-72 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
                <p className="border-b border-ink-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {hasMultipleOrgs ? "Switch organization" : "Your organization"}
                </p>
                <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
                  {memberships.map((m) => {
                    const active = m.organization_id === activeOrgId;
                    return (
                      <li key={m.organization_id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                            active ? "bg-brand-50" : ""
                          }`}
                          onClick={() => {
                            setActiveOrgId(m.organization_id);
                            setOrgOpen(false);
                          }}
                        >
                          <span className={`truncate font-semibold ${active ? "text-brand-800" : "text-ink-900"}`}>
                            {m.organization_name}
                          </span>
                          <span className="truncate text-[11px] capitalize text-ink-500">
                            {m.role.replaceAll("_", " ")}
                            {m.is_personal ? " · personal" : " · team"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-ink-100 p-2">
                  <Link
                    href="/dashboard?newOrg=1"
                    className="block rounded-lg px-2 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    onClick={() => setOrgOpen(false)}
                  >
                    + Create organization
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative hidden md:block">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="w-48 rounded-xl border border-ink-200 bg-surface-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 lg:w-56"
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
