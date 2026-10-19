import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScopeBody, ScopeSkeleton } from "@/components/scope-body";
import { getFamilyPage, getPrerenderedGenerationSlugs } from "@/lib/family";

type Props = PageProps<"/markets/[make]/[family]/[generation]">;

// Generations of the most-listed families are built ahead of time; the rest render
// on their first visit and are cached from then on.
export async function generateStaticParams() {
  return getPrerenderedGenerationSlugs(25);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make, family, generation } = await params;
  const data = await getFamilyPage(make, family, generation);
  return {
    title: data?.generation
      ? `${data.generation.label} ${data.nav.familyName} · ${data.nav.makeName} · OD`
      : "Generation not found · OD",
  };
}

export default function GenerationRoute({ params }: Props) {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <GenerationContent params={params} />
    </Suspense>
  );
}

async function GenerationContent({ params }: { params: Props["params"] }) {
  const { make, family, generation } = await params;
  const data = await getFamilyPage(make, family, generation);
  if (!data) notFound();
  return <ScopeBody data={data} />;
}
