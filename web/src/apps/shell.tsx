import type { ReactNode } from "react";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 px-4 py-2.5">
        <h1 className="text-sm font-bold text-white">{title}</h1>
        {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">{message}</div>;
}
