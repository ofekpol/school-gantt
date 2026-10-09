import { notFound } from "next/navigation";
import { ReadOnlyViewerShell } from "@/components/ReadOnlyViewerShell";
import { listSchools } from "@/lib/db/schools";
import { loadPublicViewerData } from "@/lib/views/public-viewer-data";
import { parsePublicViewerParams } from "@/lib/views/public-viewer";

/** PRD §11 — public freshness ≤ 5 s after publish, same as the full public viewer. */
export const revalidate = 5;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReadOnlySchedulePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const [school] = await listSchools();
  if (!school) notFound();

  const data = await loadPublicViewerData(school.slug);
  if (!data) notFound();

  return (
    <ReadOnlyViewerShell
      schoolSlug={school.slug}
      schoolName={data.school.name}
      initialParams={parsePublicViewerParams(toUrlSearchParams(sp))}
      year={data.year}
      eventTypes={data.eventTypes}
      gradeColors={data.gradeColors}
      initialEvents={data.events}
      initialEventsSignature={data.eventSignature}
    />
  );
}

function toUrlSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
