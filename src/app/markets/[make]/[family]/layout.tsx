import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { GenerationTabs } from "@/components/generation-tabs";
import { getFamilyNav } from "@/lib/family";

// Shared by a family page and its generation sub-pages: the back link, the family
// title and, when the family has generations, the tabs between them. It stays put
// when switching tabs; only the page below re-renders.
export default function FamilyLayout({ params, children }: LayoutProps<"/markets/[make]/[family]">) {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <BackLink href="/markets">Markets</BackLink>
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
        <Link
          href={`/markets/${nav.makeSlug}`}
          className="text-lg font-normal text-muted decoration-line-strong underline-offset-4 hover:text-fg hover:underline"
        >
          {nav.makeName}
        </Link>
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
