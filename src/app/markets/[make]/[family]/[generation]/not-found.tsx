"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Renders inside the family layout, so the family title and generation tabs stay
// above it; the link goes back to the family's "All" page.
export default function GenerationNotFound() {
  const familyHref = usePathname().split("/").slice(0, -1).join("/") || "/markets";
  return (
    <div className="py-12">
      <h2 className="text-[22px] font-semibold tracking-tight">Generation not found</h2>
      <p className="mt-2 text-sm text-muted">We don&apos;t have any auctions for that generation of this model.</p>
      <Link
        href={familyHref}
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-forest-500 px-5 text-sm font-semibold text-canvas hover:bg-forest-400"
      >
        View all generations
      </Link>
    </div>
  );
}
