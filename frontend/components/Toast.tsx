"use client";

/** @deprecated Prefer AlertProvider popup for auth/critical errors. Kept as thin re-export. */
export { AlertProvider as ToastProvider, useAlert as useToast } from "@/components/AlertModal";
