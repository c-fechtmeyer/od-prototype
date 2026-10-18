import type { ReactNode } from "react";

// A small "i" that reveals a definition on hover, keyboard focus, or tap. The panel
// is positioned against the nearest `relative` ancestor (e.g. the tile), not the icon,
// so it takes that ancestor's width and never runs off the edge of the screen. It
// stays display:none while closed, so it never adds page overflow.
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
  return (
    <span className={`group/tip inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        className="grid size-4 place-items-center rounded-full text-faint transition-colors hover:text-fg focus-visible:text-fg focus-visible:outline-2 focus-visible:outline-forest-400"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 7.25v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
        </svg>
      </button>
      <span
        id={id}
        role="tooltip"
        className="absolute inset-x-0 top-full z-20 mt-2 hidden rounded-lg border border-line-strong bg-surface-3 p-3 text-xs leading-relaxed font-normal text-fg shadow-lg shadow-black/40 group-focus-within/tip:block group-hover/tip:block"
      >
        {children}
      </span>
    </span>
  );
}
