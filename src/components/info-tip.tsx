"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 6; // between the icon and the panel
const EDGE = 8; // minimum distance from the viewport edge

// A small "i" that shows a definition on hover, keyboard focus, or tap. The panel
// opens up and to the right of the icon and shifts left or flips below if it would
// leave the viewport. It renders in a portal so ancestor layout (no-wrap labels,
// overflow) can't affect it.
export function InfoTip({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);

  // Place the panel before paint so it never flashes in the wrong spot.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!open || !button || !panel) return;
    const icon = button.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth; // excludes the scrollbar
    const left = Math.max(EDGE, Math.min(icon.right + GAP, viewport - width - EDGE));
    const above = icon.top - height - GAP;
    panel.style.left = `${left}px`;
    panel.style.top = `${above >= EDGE ? above : icon.bottom + GAP}px`;
    panel.style.visibility = "visible";
  }, [open]);

  // Close on a tap elsewhere, Escape, or scroll/resize (the panel is fixed-position).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className={`inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        className="grid size-4 place-items-center rounded-full text-faint transition-colors hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-forest-400"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.25v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
        </svg>
      </button>
      {/* Always in the DOM for screen readers; the floating panel is the visual copy. */}
      <span id={id} className="sr-only">
        {children}
      </span>
      {open &&
        createPortal(
          <span
            ref={panelRef}
            aria-hidden="true"
            style={{ visibility: "hidden" }}
            className="pointer-events-none fixed z-50 block w-64 max-w-[calc(100vw-16px)] rounded-lg border border-line-strong/70 bg-surface-3/75 px-3 py-2.5 text-xs leading-relaxed font-normal text-fg shadow-lg shadow-black/30 backdrop-blur-md"
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
