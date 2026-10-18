import Link from "next/link";
import { Suspense } from "react";
import { ActiveNavLinks, NavLinks } from "@/components/nav-links";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="OD home">
          <svg viewBox="0 0 28 28" className="size-7" aria-hidden="true">
            <rect width="28" height="28" rx="8" className="fill-forest-700" />
            <path
              d="M6 19.5 11 13l4 3.5L22 8"
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-forest-200"
            />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">
            OD<span className="text-forest-400">.</span>
          </span>
        </Link>

        {/* The active link needs the pathname, which a future dynamic route may not know at prerender. */}
        <Suspense fallback={<NavLinks />}>
          <ActiveNavLinks />
        </Suspense>
      </div>
    </header>
  );
}
