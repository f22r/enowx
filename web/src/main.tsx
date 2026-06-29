import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Desktop } from "./os/Desktop";
import { DialogProvider } from "./os/dialog";
import { AuthGate } from "./os/AuthGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <AuthGate>
        <Desktop />
      </AuthGate>
    </DialogProvider>
  </StrictMode>
);
