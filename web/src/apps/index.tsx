import { KeyRound, ScrollText, Boxes, Settings } from "lucide-react";
import type { DesktopApp } from "../os/types";
import { AccountsApp } from "./AccountsApp";
import { RequestsApp } from "./RequestsApp";
import { ProvidersApp } from "./ProvidersApp";
import { SettingsApp } from "./SettingsApp";

export function buildApps(): DesktopApp[] {
  return [
    { id: "accounts", label: "Accounts", icon: <KeyRound />, accent: "from-violet-500 to-fuchsia-600", render: () => <AccountsApp />, width: 720, height: 560 },
    { id: "requests", label: "Requests", icon: <ScrollText />, accent: "from-sky-500 to-indigo-600", render: () => <RequestsApp />, width: 860, height: 560 },
    { id: "providers", label: "Providers", icon: <Boxes />, accent: "from-emerald-500 to-teal-600", render: () => <ProvidersApp />, width: 720, height: 540 },
    { id: "settings", label: "Settings", icon: <Settings />, accent: "from-slate-500 to-slate-700", render: () => <SettingsApp />, width: 640, height: 520 },
  ];
}
