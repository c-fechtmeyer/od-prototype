import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GenerationTabs } from "@/components/generation-tabs";
import { getFamilyNav } from "@/lib/family";

// Shared by a family page and its generation sub-pages: the back link, the family
// title and, when the family has generations, the tabs between them. It stays put
// when switching tabs; only the page below re-renders.
export default function FamilyLayout({ params, children }: LayoutProps<"/markets/[make]/[family]">) {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link href="/markets" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Markets
      </Link>
      {/* params is awaited inside the boundary, so unlisted families still get an instant shell. */}
      <Suspense fallback={<HeaderSkeleton />}>
        <FamilyHeader params={params} />
      </Suspense>
      {children}
    </main>
  );
}

async function FamilyHeader({ params }: { params: LayoutProps<"/markets/[make]/[family]">["params"] }) {
  const { make, family } = await params;
  const nav = await getFamilyNav(make, family);
  if (!nav) notFound();

  return (
    <div className="pt-3">
      <h1 className="flex flex-wrap items-baseline gap-x-3 text-[28px] font-semibold tracking-tight">
        {nav.familyName}
        <span className="text-lg font-normal text-muted">{nav.makeName}</span>
      </h1>
      {nav.generations.length > 0 && <GenerationTabs nav={nav} />}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="animate-pulse pt-3">
      <div className="h-8 w-48 rounded-md bg-surface-3" />
    </div>
  );
}
