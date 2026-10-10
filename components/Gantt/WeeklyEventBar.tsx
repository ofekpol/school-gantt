import type { CSSProperties } from "react";
import { Ban, Pencil } from "lucide-react";
import type { WeeklyEventBar as WeeklyEventBarModel } from "@/lib/views/gantt-weekly";
import { eventColorScheme, type EventColorScheme, type GradeColorMap } from "@/lib/grade-colors";

export const LANE_H = 26;
export const LANE_GAP = 4;
export const ROW_PAD = 12;

const CANCELED_BAR: CSSProperties = {
  background: "repeating-linear-gradient(135deg, #fee2e2 0 8px, #fecaca 8px 10px)",
  color: "#991b1b",
  border: "1px solid #fca5a5",
};

/**
 * Bar paint for one event (design "W2-C"): pastel grade fill with dark grade
 * text; multi-grade bars are white with grade dots; whole-school bars use the
 * neutral school swatch. Color comes from the grade scheme only.
 */
function barColors(bar: WeeklyEventBarModel, scheme: EventColorScheme): CSSProperties {
  if (bar.status === "canceled" || bar.isCanceled) return CANCELED_BAR;
  if (bar.status === "draft") {
    const edge = scheme.kind === "multi" ? "#8A8984" : scheme.text;
    return { background: "transparent", color: "var(--sg-ink)", border: `1.5px dashed ${edge}` };
  }
  if (scheme.kind === "multi") {
    return { background: "#ffffff", color: "#2A2926", border: "1px solid #E0DDD5" };
  }
  return { background: scheme.fill, color: scheme.text, border: "none" };
}

interface Props {
  bar: WeeklyEventBarModel;
  gradeColors: GradeColorMap;
  onSelect: (id: string) => void;
}

export function WeeklyEventBar({ bar, gradeColors, onSelect }: Props) {
  const isCanceled = bar.status === "canceled" || bar.isCanceled;
  const scheme = eventColorScheme(bar.grades, gradeColors);
  const style = barColors(bar, scheme);
  const label = isCanceled ? `מבוטל · ${bar.title}` : bar.isUpdated ? `עודכן · ${bar.title}` : bar.title;

  return (
    <button
      type="button"
      onClick={() => onSelect(bar.eventId)}
      title={label}
      aria-label={label}
      data-color-kind={scheme.kind}
      style={{
        position: "absolute",
        insetInlineStart: `${bar.startPct}%`,
        width: `${bar.widthPct}%`,
        minWidth: 76,
        top: ROW_PAD + bar.lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        borderRadius: 6,
        padding: "0 9px",
        fontSize: 12, fontWeight: 500,
        display: "flex", alignItems: "center", gap: 4,
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "start",
        zIndex: 2,
        pointerEvents: "auto",
        ...style,
      }}
    >
      {!isCanceled && scheme.dots.length > 0 && <GradeDots colors={scheme.dots} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 auto", minWidth: 0, textDecoration: isCanceled ? "line-through" : "none" }}>
        {bar.title}
      </span>
      {(isCanceled || bar.isUpdated) && <StatusIcon canceled={Boolean(isCanceled)} />}
    </button>
  );
}

export function GradeDots({ colors }: { colors: string[] }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          style={{ width: 7, height: 7, borderRadius: 999, background: color }}
        />
      ))}
    </span>
  );
}

function StatusIcon({ canceled }: { canceled: boolean }) {
  return (
    <span style={{
      flexShrink: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 14,
      height: 14,
      borderRadius: 999,
      background: canceled ? "#fecaca" : "#bfdbfe",
      color: canceled ? "#7f1d1d" : "#1e3a8a",
    }}>
      {canceled ? <Ban size={9} /> : <Pencil size={9} />}
    </span>
  );
}
