"use client";

import { createContext, useContext, useCallback, useRef, useState } from "react";
import { CheckCircle2, X, AlertTriangle, Info, AlertCircle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

const STYLES = {
  success: "border-emerald-200 bg-white dark:bg-card dark:border-emerald-800",
  error: "border-red-200 bg-white dark:bg-card dark:border-red-800",
  warning: "border-amber-200 bg-white dark:bg-card dark:border-amber-800",
  info: "border-blue-200 bg-white dark:bg-card dark:border-blue-800",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = `toast-${++idRef.current}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error = useCallback((msg: string) => toast(msg, "error", 5000), [toast]);
  const warning = useCallback((msg: string) => toast(msg, "warning"), [toast]);
  const info = useCallback((msg: string) => toast(msg, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`toast-in pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-enterprise text-sm font-medium ${STYLES[t.type]}`}
            style={{ minWidth: "260px", maxWidth: "400px" }}
          >
            {ICONS[t.type]}
            <span className="flex-1 text-foreground">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
