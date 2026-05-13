"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";

export type ToastTone = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = toast.duration ?? 3500;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Provider yoksa no-op (SSR vb. durumlarda)
    return { push: () => {}, dismiss: () => {} } as ToastContextValue;
  }
  return ctx;
}

function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 360 }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

const TONE_CONFIG: Record<ToastTone, { color: string; bg: string; icon: ReactNode }> = {
  success: {
    color: "var(--up)",
    bg: "var(--up-bg)",
    icon: <Check size={14} strokeWidth={2.4} />,
  },
  error: {
    color: "var(--down)",
    bg: "var(--down-bg)",
    icon: <AlertCircle size={14} strokeWidth={2} />,
  },
  warn: {
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    icon: <AlertCircle size={14} strokeWidth={2} />,
  },
  info: {
    color: "var(--accent-primary)",
    bg: "var(--accent-muted)",
    icon: <Info size={14} strokeWidth={2} />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = TONE_CONFIG[toast.tone];
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-lg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity var(--transition-base), transform var(--transition-base)",
      }}
      className="pointer-events-auto rounded-xl p-3 flex items-start gap-3 min-w-[280px]"
      role="status"
    >
      <div
        style={{ background: cfg.bg, color: cfg.color, width: 24, height: 24 }}
        className="rounded-full flex items-center justify-center shrink-0 mt-0.5"
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: "var(--text-primary)" }} className="text-[13px] font-semibold leading-tight">
          {toast.title}
        </p>
        {toast.description && (
          <p style={{ color: "var(--text-muted)" }} className="text-[11.5px] mt-1 leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{ color: "var(--text-muted)" }}
        className="hover:text-[var(--text-primary)] transition-colors shrink-0"
        aria-label="Bildirimi kapat"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
