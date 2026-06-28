import { AppShell, Empty } from "./shell";

export function RequestsApp() {
  return (
    <AppShell title="Requests" subtitle="Recent API requests">
      <Empty message="No requests yet." />
    </AppShell>
  );
}
