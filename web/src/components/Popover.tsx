import { useEffect, type ReactNode } from "react";

// Reusable popover panel with click-away + Escape to dismiss. Render it
// conditionally (when open) as a sibling of its anchor inside a `relative`
// container; pass `anchor` to position it. The transparent backdrop catches any
// outside click so the user never has to click the trigger again to close.
//
// MANDATORY: every dismissable popover/dropdown must close on an outside click
// (and Escape). Use this component instead of a bare absolute panel — see
// AGENTS.md "Popovers dismiss on outside click".
export function Popover({
  onClose,
  children,
  className = "",
  anchor = "right",
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  anchor?: "left" | "right" | "center";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pos =
    anchor === "left"
      ? "left-0"
      : anchor === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return (
    <>
      {/* Transparent click-away layer: any click outside the panel closes it. */}
      <div className="pointer-events-auto fixed inset-0 z-[10000]" onClick={onClose} />
      <div className={`pointer-events-auto absolute top-8 z-[10001] ${pos} ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </>
  );
}
