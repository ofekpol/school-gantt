import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventDrawer } from "@/components/Gantt/EventDrawer";
import type { AgendaItem } from "@/lib/views/agenda-model";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const labels: Record<string, string> = {
      "dashboard.edit": "edit",
      "wizard.step5.startLabel": "start time",
      "wizard.step5.endLabel": "end time",
      "wizard.step5.allDay": "all day",
    };
    return labels[`${namespace}.${key}`] ?? key;
  },
}));

afterEach(() => cleanup());

describe("EventDrawer editing", () => {
  it("shows editable start and end times in chronological order", async () => {
    const user = userEvent.setup();

    render(
      <EventDrawer
        event={eventItem()}
        canEdit
        eventTypes={[eventType()]}
        allowedGrades={[7]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "edit" }));

    expect(screen.getByLabelText("start time")).toHaveValue("00:09");
    expect(screen.getByLabelText("end time")).toHaveValue("00:10");
    expect(screen.getByLabelText("start time").closest("[dir='ltr']")).not.toBeNull();
  });
});

function eventItem(): AgendaItem & { canEdit?: boolean } {
  return {
    id: "event-1",
    title: "טיול",
    startAt: new Date("2026-05-25T21:09:00.000Z"),
    endAt: new Date("2026-05-25T21:10:00.000Z"),
    allDay: false,
    description: null,
    location: null,
    eventTypeId: "type-1",
    eventTypeKey: "sport",
    eventTypeLabelHe: "ספורט",
    eventTypeColor: "#d946ef",
    eventTypeGlyph: "X",
    grades: [7],
    status: "approved",
    isCanceled: false,
    isUpdated: false,
    canEdit: true,
  };
}

function eventType() {
  return {
    id: "type-1",
    key: "sport",
    labelHe: "ספורט",
    labelEn: "Sport",
    colorHex: "#d946ef",
    glyph: "X",
    sortOrder: 1,
  };
}
