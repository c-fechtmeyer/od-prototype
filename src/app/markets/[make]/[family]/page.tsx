import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScopeBody, ScopeSkeleton } from "@/components/scope-body";
import { getFamilyPage, getPrerenderedFamilySlugs } from "@/lib/family";

// The most-listed families are built ahead of time; any other family renders on
// its first visit (behind the skeleton below) and is cached from then on.
export async function generateStaticParams() {
  return getPrerenderedFamilySlugs(25);
}

export async function generateMetadata({ params }: PageProps<"/markets/[make]/[family]">): Promise<Metadata> {
  const { make, family } = await params;
  const data = await getFamilyPage(make, family);
  return { title: data ? `${data.nav.familyName} · ${data.nav.makeName} · OD` : "Model not found · OD" };
}

export default function FamilyRoute({ params }: PageProps<"/markets/[make]/[family]">) {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <FamilyContent params={params} />
    </Suspense>
  );
}

async function FamilyContent({ params }: { params: PageProps<"/markets/[make]/[family]">["params"] }) {
  const { make, family } = await params;
  const data = await getFamilyPage(make, family);
  if (!data) notFound();
  return <ScopeBody data={data} />;
}
