"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

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
  { wrap: string; iconBg: string; button: string; icon: string }
> = {
  error: {
    wrap: "border-rose-100",
    iconBg: "bg-rose-100 text-rose-700",
    button: "bg-rose-600 hover:bg-rose-700",
    icon: "!",
  },
  warning: {
    wrap: "border-amber-100",
    iconBg: "bg-amber-100 text-amber-800",
    button: "bg-amber-600 hover:bg-amber-700",
    icon: "!",
  },
  success: {
    wrap: "border-brand-100",
    iconBg: "bg-brand-100 text-brand-800",
    button: "bg-brand-600 hover:bg-brand-700",
    icon: "✓",
  },
  info: {
    wrap: "border-sky-100",
    iconBg: "bg-sky-100 text-sky-800",
    button: "bg-sky-600 hover:bg-sky-700",
    icon: "i",
  },
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState>({
    open: false,
    title: "",
    message: "",
    tone: "info",
  });

  const close = useCallback(() => {
    setAlert((prev) => ({ ...prev, open: false }));
  }, []);

  const show = useCallback((input: { title?: string; message: string; tone?: AlertTone }) => {
    const tone = input.tone || "info";
    setAlert({
      open: true,
      title: input.title || (tone === "error" ? "Error" : tone === "warning" ? "Please check" : "Notice"),
      message: input.message,
      tone,
    });
  }, []);

  const value = useMemo<AlertContextValue>(
    () => ({
      show,
      error: (message, title = "Sign in error") => show({ title, message, tone: "error" }),
      warning: (message, title = "Please check") => show({ title, message, tone: "warning" }),
      success: (message, title = "Success") => show({ title, message, tone: "success" }),
    }),
    [show],
  );

  const style = tones[alert.tone];

  return (
    <AlertContext.Provider value={value}>
      {children}
      {alert.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
            aria-label="Close dialog"
            onClick={close}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hm-alert-title"
            aria-describedby="hm-alert-desc"
            className={`relative w-full max-w-md animate-fade-up rounded-3xl border bg-white p-6 shadow-float ${style.wrap}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${style.iconBg}`}
              >
                {style.icon}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id="hm-alert-title" className="font-display text-xl font-bold text-ink-950">
                  {alert.title}
                </h2>
                <p id="hm-alert-desc" className="mt-2 text-sm leading-relaxed text-ink-600">
                  {alert.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={close}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${style.button}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}
