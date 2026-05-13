import type { CalendarMonth } from "@/lib/views/calendar";

const MONTH_LABELS_HE = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const WEEKDAY_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

interface Props {
  months: CalendarMonth[];
  yearLabel: string;
  schoolName: string;
}

/**
 * Renders one printable page per month. Day cells show truncated event chips
 * colored by event type. The print stylesheet adds page breaks between
 * months and adjusts cell size for A4 / A3. Monochrome fallback uses the
 * event-type glyph + dashed border so chips remain distinguishable when
 * printed in black-and-white.
 */
export function YearCalendarGrid({ months, yearLabel, schoolName }: Props) {
  return (
    <div className="year-calendar p-4">
      {months.map((m) => (
        <section
          key={`${m.year}-${m.monthIndex}`}
          className="calendar-month bg-white rounded-md border border-neutral-200 p-4 mb-6 print:mb-0 print:border-0 print:rounded-none"
        >
          <header className="flex items-baseline justify-between mb-3 print:mb-2">
            <h2 className="text-lg font-bold">
              {MONTH_LABELS_HE[m.monthIndex - 1]} {m.year}
            </h2>
            <p className="hidden print:block text-xs text-neutral-500">
              {schoolName} · {yearLabel}
            </p>
          </header>
          <div className="grid grid-cols-7 gap-px text-center text-xs font-medium text-neutral-500 mb-1">
            {WEEKDAY_HE.map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-neutral-200">
            {m.weeks.flatMap((w, wi) =>
              w.days.map((day, di) => (
                <div
                  key={`${wi}-${di}`}
                  className="calendar-day bg-white min-h-[88px] p-1 align-top"
                >
                  {day && (
                    <>
                      <div className="text-[11px] font-medium text-neutral-700 mb-0.5">
                        {day.dayOfMonth}
                      </div>
                      <ul className="space-y-0.5">
                        {day.events.slice(0, 4).map((chip) => (
                          <li
                            key={chip.id}
                            className="event-chip flex items-center gap-1 rounded-sm border border-black/10 px-1 py-0.5 text-[10px] text-white truncate"
                            style={{ backgroundColor: chip.eventTypeColor }}
                            title={chip.title}
                          >
                            <span aria-hidden="true" className="event-chip-glyph">
                              {chip.eventTypeGlyph}
                            </span>
                            <span className="truncate">{chip.title}</span>
                          </li>
                        ))}
                        {day.events.length > 4 && (
                          <li className="text-[9px] text-neutral-500">
                            +{day.events.length - 4}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
