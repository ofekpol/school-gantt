"use client";

import { memo } from "react";
import { GanttCanvas } from "@/components/Gantt/GanttCanvas";
import { GanttWeekly } from "@/components/Gantt/GanttWeekly";
import { buildGanttModel } from "@/lib/views/gantt";
import { buildWeeklyModel, parseWeekParam } from "@/lib/views/gantt-weekly";
import {
  hydratePublicEvents,
  type PublicViewerEvent,
  type PublicViewerParams,
} from "@/lib/views/public-viewer";
import type { PublicViewerYear } from "@/lib/views/public-viewer-data";

interface Props {
  events: ReturnType<typeof hydratePublicEvents>;
  serializedEvents: PublicViewerEvent[];
  year: PublicViewerYear;
  params: PublicViewerParams;
  grades: number[];
  emptyLabel: string;
  onWeekChange: (weekStart: Date) => void;
}

export const PublicGanttView = memo(function PublicGanttView({
  events,
  serializedEvents,
  year,
  params,
  grades,
  emptyLabel,
  onWeekChange,
}: Props) {
  if (params.zoom === "week") {
    const model = buildWeeklyModel(
      parseWeekParam(params.week ?? undefined),
      events,
      grades,
      new Date(),
    );
    return (
      <GanttWeekly
        model={model}
        events={serializedEvents}
        navigationMode="local"
        onWeekChange={onWeekChange}
      />
    );
  }

  const model = buildGanttModel({ year, grades, events });
  return (
    <GanttCanvas
      events={serializedEvents}
      bars={model.bars}
      months={model.months}
      grades={grades}
      zoom={params.zoom}
      emptyLabel={emptyLabel}
    />
  );
});
