"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatCount } from "@/lib/format";
import type { FamilyNav } from "@/lib/family";

// "All" plus one tab per generation, oldest first. The active tab comes from the
// URL segment below the family (null on the family page itself).
export function GenerationTabs({ nav }: { nav: FamilyNav }) {
  const active = useSelectedLayoutSegment();
  const base = `/markets/${nav.makeSlug}/${nav.familySlug}`;
  const stripRef = useRef<HTMLDivElement>(null);

  // On narrow screens the strip scrolls sideways; bring the current tab into view
  // (centered) without scrolling the page itself.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
  }, [active]);
  const tabs = [
    { slug: null, label: "All", auctions: nav.auctions, href: base },
    ...nav.generations.map((g) => ({ ...g, href: `${base}/${g.slug}` })),
  ];

  return (
    <nav aria-label={`${nav.familyName} generations`} className="mt-5 border-b border-line">
      <div
        ref={stripRef}
        className="relative -mb-px flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const current = t.slug === active;
          return (
            <Link
              key={t.slug ?? "all"}
              href={t.href}
              aria-current={current ? "page" : undefined}
              className={`flex shrink-0 items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors first:pl-0 ${
                current ? "border-forest-400 text-forest-300" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label}
              <span className="text-xs font-normal text-faint tabular-nums">{formatCount(t.auctions)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
