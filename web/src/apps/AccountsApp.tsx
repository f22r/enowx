import { AppShell, Empty } from "./shell";

export function AccountsApp() {
  return (
    <AppShell title="Accounts" subtitle="Per-provider keys (the pool)">
      <Empty message="No accounts yet. Add one to start serving." />
    </AppShell>
  );
}
