import { notFound } from "next/navigation";
import { PublicViewerShell } from "@/components/PublicViewerShell";
import { loadPublicViewerData } from "@/lib/views/public-viewer-data";
import { parsePublicViewerParams } from "@/lib/views/public-viewer";

/** PRD §11 — public freshness ≤ 5 s after publish. */
export const revalidate = 5;

interface PageProps {
  params: Promise<{ school: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GanttPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const sp = await searchParams;
  const data = await loadPublicViewerData(slug);
  if (!data) notFound();

  return (
    <PublicViewerShell
      schoolSlug={slug}
      schoolName={data.school.name}
      initialView="gantt"
      initialParams={withGanttDefaultZoom(parsePublicViewerParams(toUrlSearchParams(sp)), sp)}
      year={data.year}
      eventTypes={data.eventTypes}
      initialEvents={data.events}
      initialEventsSignature={data.eventSignature}
    />
  );
}

function withGanttDefaultZoom(
  params: ReturnType<typeof parsePublicViewerParams>,
  sp: Record<string, string | string[] | undefined>,
) {
  return sp.zoom === undefined ? { ...params, zoom: "week" as const } : params;
}

function toUrlSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}
