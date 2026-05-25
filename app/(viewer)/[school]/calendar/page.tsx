import { notFound } from "next/navigation";
import "@/app/print.css";
import { PublicViewerShell } from "@/components/PublicViewerShell";
import { loadPublicViewerData } from "@/lib/views/public-viewer-data";
import { parsePublicViewerParams } from "@/lib/views/public-viewer";

export const revalidate = 5;

interface PageProps {
  params: Promise<{ school: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CalendarPage({ params, searchParams }: PageProps) {
  const { school: slug } = await params;
  const [data, sp] = await Promise.all([loadPublicViewerData(slug), searchParams]);
  if (!data) notFound();
  if (!data.year) return null;

  return (
    <PublicViewerShell
      schoolSlug={slug}
      schoolName={data.school.name}
      initialView="calendar"
      initialParams={parsePublicViewerParams(toUrlSearchParams(sp))}
      year={data.year}
      eventTypes={data.eventTypes}
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
