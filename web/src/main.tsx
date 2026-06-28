import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Desktop } from "./os/Desktop";
import { DialogProvider } from "./os/dialog";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <Desktop />
    </DialogProvider>
  </StrictMode>
);
