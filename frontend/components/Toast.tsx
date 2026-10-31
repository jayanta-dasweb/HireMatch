"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastTone = "error" | "success" | "warning" | "info";

type ToastItem = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (input: { title?: string; message: string; tone?: ToastTone }) => void;
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-900",
  success: "border-brand-200 bg-brand-50 text-brand-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const toneLabel: Record<ToastTone, string> = {
  error: "Error",
  success: "Success",
  warning: "Warning",
  info: "Info",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ title, message, tone = "info" }: { title?: string; message: string; tone?: ToastTone }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev, { id, title: title || toneLabel[tone], message, tone }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      error: (message, title = "Something went wrong") => push({ title, message, tone: "error" }),
      success: (message, title = "Done") => push({ title, message, tone: "success" }),
      warning: (message, title = "Please check") => push({ title, message, tone: "warning" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-up rounded-2xl border px-4 py-3 shadow-float ${toneStyles[toast.tone]}`}
            role="alert"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{toast.title}</p>
                <p className="mt-1 text-sm leading-relaxed opacity-90">{toast.message}</p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
