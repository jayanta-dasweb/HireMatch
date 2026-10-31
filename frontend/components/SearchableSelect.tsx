"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
};

/** Select2-style searchable dropdown — no extra package. */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
  className = "",
  emptyText = "No matches",
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords || ""} ${o.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt.value);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="admin-input flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected ? "text-ink-900" : "text-ink-400"}`}>
          {selected?.label || placeholder}
        </span>
        <svg className="h-4 w-4 shrink-0 text-ink-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.25 7.5 10 12.25 14.75 7.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-[9100] mt-1 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
          <div className="border-b border-ink-100 p-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onListKey}
              placeholder={searchPlaceholder}
              className="admin-input w-full text-sm"
              aria-autocomplete="list"
              aria-controls={listId}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-400">{emptyText}</li>
            )}
            {filtered.map((opt, idx) => {
              const active = idx === activeIndex;
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={`flex w-full px-3 py-2 text-left text-sm ${
                      active ? "bg-brand-50 text-brand-900" : "text-ink-800 hover:bg-ink-50"
                    } ${isSelected ? "font-semibold" : ""}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => pick(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {options.length > 8 && (
            <p className="border-t border-ink-100 px-3 py-1.5 text-[11px] text-ink-400">
              Showing {filtered.length} of {options.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
