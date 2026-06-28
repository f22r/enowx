import type { ReactNode } from "react";

export type AppId = "accounts" | "requests" | "providers" | "settings";

export interface DesktopApp {
  id: AppId;
  label: string;
  icon: ReactNode;
  accent: string; // tailwind gradient classes
  render: () => ReactNode;
  width?: number;
  height?: number;
}

export interface OpenWindow {
  id: string;
  appId: AppId;
  x: number;
  y: number;
  z: number;
}
