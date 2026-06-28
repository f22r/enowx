import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

// Reusable modal dialogs (confirm / alert / prompt). Use these instead of the
// browser's window.confirm/alert/prompt — see AGENTS.md "Use modal dialogs".

type Kind = "confirm" | "alert" | "prompt";

interface DialogSpec {
  kind: Kind;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

interface DialogAPI {
  confirm(o: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean>;
  alert(o: { title: string; message?: string; confirmLabel?: string }): Promise<void>;
  prompt(o: { title: string; message?: string; placeholder?: string; defaultValue?: string; confirmLabel?: string }): Promise<string | null>;
}

const Ctx = createContext<DialogAPI | null>(null);

export function useDialog(): DialogAPI {
  const api = useContext(Ctx);
  if (!api) throw new Error("useDialog must be used within DialogProvider");
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((v: unknown) => void) | null>(null);

  const open = useCallback((s: DialogSpec) => {
    setValue(s.defaultValue ?? "");
    setSpec(s);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (v: unknown) => {
    resolver.current?.(v);
    resolver.current = null;
    setSpec(null);
  };

  const api: DialogAPI = {
    confirm: (o) => open({ kind: "confirm", ...o }) as Promise<boolean>,
    alert: (o) => open({ kind: "alert", ...o }) as Promise<void>,
    prompt: (o) => open({ kind: "prompt", ...o }) as Promise<string | null>,
  };

  const onConfirm = () => {
    if (spec?.kind === "prompt") settle(value);
    else if (spec?.kind === "confirm") settle(true);
    else settle(undefined);
  };
  const onCancel = () => {
    if (spec?.kind === "prompt") settle(null);
    else if (spec?.kind === "confirm") settle(false);
    else settle(undefined);
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {spec && (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <div
            className="glass w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[var(--window-bg)]/95 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4">
              <h3 className="text-sm font-semibold text-white">{spec.title}</h3>
              {spec.message && <p className="mt-1.5 text-xs leading-relaxed text-white/55">{spec.message}</p>}
              {spec.kind === "prompt" && (
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={spec.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onConfirm();
                    if (e.key === "Escape") onCancel();
                  }}
                  className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
                />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2 px-4 pb-4">
              {spec.kind !== "alert" && (
                <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white">
                  {spec.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                onClick={onConfirm}
                autoFocus={spec.kind !== "prompt"}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 ${
                  spec.danger ? "bg-red-500 text-white" : "bg-white text-black"
                }`}
              >
                {spec.confirmLabel ?? (spec.kind === "alert" ? "OK" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
