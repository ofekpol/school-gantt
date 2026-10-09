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

/** Bar paint for one event. Color comes from the grade scheme only. */
function barColors(
  bar: WeeklyEventBarModel,
  scheme: EventColorScheme,
): { style: CSSProperties; glyphColor: string } {
  const isVacation = bar.eventTypeKey === "vacation" || bar.eventTypeKey === "bagrut";
  const accent = scheme.kind === "multi" ? "#8A8984" : scheme.fill;
  if (bar.status === "canceled" || bar.isCanceled) return { style: CANCELED_BAR, glyphColor: "#991b1b" };
  if (bar.status === "draft") {
    return {
      style: { background: "transparent", color: "var(--sg-ink)", border: `1.5px dashed ${accent}` },
      glyphColor: accent,
    };
  }
  if (isVacation && scheme.kind !== "multi") {
    return {
      style: { background: scheme.fill, color: scheme.text, border: "none" },
      glyphColor: scheme.text,
    };
  }
  if (scheme.kind === "multi") {
    return {
      style: { background: "#ffffff", color: "var(--sg-ink)", border: "1px solid #CFCBC1" },
      glyphColor: "var(--sg-ink-soft)",
    };
  }
  return {
    style: {
      background: `color-mix(in oklch, ${scheme.fill} 18%, white)`,
      color: "var(--sg-ink)",
      border: "none",
      borderInlineEnd: `3px solid ${scheme.fill}`,
    },
    glyphColor: scheme.fill,
  };
}

interface Props {
  bar: WeeklyEventBarModel;
  gradeColors: GradeColorMap;
  onSelect: (id: string) => void;
}

export function WeeklyEventBar({ bar, gradeColors, onSelect }: Props) {
  const isCanceled = bar.status === "canceled" || bar.isCanceled;
  const scheme = eventColorScheme(bar.grades, gradeColors);
  const { style, glyphColor } = barColors(bar, scheme);
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
        borderRadius: 5,
        padding: "0 6px 0 8px",
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
      <span style={{ width: 12, height: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <EventTypeGlyph glyph={bar.eventTypeGlyph} color={glyphColor} />
      </span>
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

/* ---- Glyph helper (emoji fallback) ---- */
const GLYPH_EMOJI: Record<string, string> = {
  book: "📚", party: "🎉", pencil: "✏️", mountain: "⛰️", compass: "🧭",
  flag: "🚩", sun: "☀️", users: "👥", cap: "🎓", heart: "💙", tag: "🏷️",
};

function EventTypeGlyph({ glyph, color }: { glyph: string; color: string }) {
  const emoji = GLYPH_EMOJI[glyph];
  if (emoji) return <span style={{ fontSize: 11 }}>{emoji}</span>;
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />;
}
