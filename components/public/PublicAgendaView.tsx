"use client";

import { memo } from "react";
import { AgendaList } from "@/components/AgendaList";
import { groupByWeek } from "@/lib/views/agenda-model";
import { hydratePublicEvents } from "@/lib/views/public-viewer";

interface Props {
  events: ReturnType<typeof hydratePublicEvents>;
  emptyLabel: string;
  mode: "week" | "month";
}

export const PublicAgendaView = memo(function PublicAgendaView({
  events,
  emptyLabel,
  mode,
}: Props) {
  return <AgendaList weeks={groupByWeek(events)} emptyLabel={emptyLabel} mode={mode} />;
});
