import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Desktop } from "./os/Desktop";
import { DialogProvider } from "./os/dialog";
import { ContextMenuProvider } from "./os/contextmenu";
import { AuthGate } from "./os/AuthGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ContextMenuProvider>
      <DialogProvider>
        <AuthGate>
          <Desktop />
        </AuthGate>
      </DialogProvider>
    </ContextMenuProvider>
  </StrictMode>
);
