"use client";
// Minimal quiet toaster. Gold tone for points, navy for info, danger for errors.
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Sparkles, Info, AlertTriangle, Check } from "lucide-react";

type Toast = {
  id: number;
  message: string;
  tone: "info" | "points" | "error" | "success";
};

type ToastContextValue = {
  toast: (message: string, tone?: Toast["tone"]) => void;
};

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

let idCounter = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const toast = React.useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = idCounter++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const icons = {
    info: <Info className="size-4 text-info" />,
    points: <Sparkles className="size-4 text-aqua-500" />,
    error: <AlertTriangle className="size-4 text-danger" />,
    success: <Check className="size-4 text-ok" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted
        ? createPortal(
            <div className="pointer-events-none fixed bottom-5 start-1/2 z-[100] flex w-[min(420px,90vw)] -translate-x-1/2 rtl:translate-x-1/2 flex-col gap-2">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  role="status"
                  className={cn(
                    "reveal pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-white px-4 py-2.5 text-sm shadow-[var(--shadow-pop)]",
                    t.tone === "points" ? "border-aqua-300" : "border-mist-300"
                  )}
                >
                  {icons[t.tone]}
                  <span className="text-ink-900">{t.message}</span>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}
