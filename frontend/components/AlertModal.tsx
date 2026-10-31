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
import { createPortal } from "react-dom";

type AlertTone = "error" | "warning" | "success" | "info";

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  tone: AlertTone;
};

type AlertContextValue = {
  show: (input: { title?: string; message: string; tone?: AlertTone }) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

const tones: Record<
  AlertTone,
  { ring: string; iconBg: string; button: string; icon: string; label: string }
> = {
  error: {
    ring: "ring-rose-200",
    iconBg: "bg-rose-600 text-white",
    button: "bg-rose-600 hover:bg-rose-700",
    icon: "!",
    label: "Error",
  },
  warning: {
    ring: "ring-amber-200",
    iconBg: "bg-amber-500 text-white",
    button: "bg-amber-600 hover:bg-amber-700",
    icon: "!",
    label: "Warning",
  },
  success: {
    ring: "ring-brand-200",
    iconBg: "bg-brand-600 text-white",
    button: "bg-brand-600 hover:bg-brand-700",
    icon: "✓",
    label: "Success",
  },
  info: {
    ring: "ring-sky-200",
    iconBg: "bg-sky-600 text-white",
    button: "bg-sky-600 hover:bg-sky-700",
    icon: "i",
    label: "Notice",
  },
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    title: "",
    message: "",
    tone: "info",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!alert.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAlert((prev) => ({ ...prev, open: false }));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [alert.open]);

  const close = useCallback(() => {
    setAlert((prev) => ({ ...prev, open: false }));
  }, []);

  const show = useCallback((input: { title?: string; message: string; tone?: AlertTone }) => {
    const tone = input.tone || "info";
    setAlert({
      open: true,
      title: input.title || tones[tone].label,
      message: input.message,
      tone,
    });
  }, []);

  const value = useMemo<AlertContextValue>(
    () => ({
      show,
      error: (message, title = "Something went wrong") => show({ title, message, tone: "error" }),
      warning: (message, title = "Please check") => show({ title, message, tone: "warning" }),
      success: (message, title = "Success") => show({ title, message, tone: "success" }),
    }),
    [show],
  );

  const style = tones[alert.tone];

  const dialog =
    mounted &&
    alert.open &&
    createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/55"
          aria-label="Close dialog"
          onClick={close}
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="hm-alert-title"
          aria-describedby="hm-alert-desc"
          className={`relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] ring-1 ${style.ring}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${style.iconBg}`}
            >
              {style.icon}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="hm-alert-title" className="font-display text-xl font-bold text-ink-950">
                {alert.title}
              </h2>
              <p id="hm-alert-desc" className="mt-2 text-sm leading-relaxed text-ink-700">
                {alert.message}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={close}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition ${style.button}`}
            >
              OK
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <AlertContext.Provider value={value}>
      {children}
      {dialog}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}
