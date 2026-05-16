"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AgendaItem } from "@/lib/views/agenda";

interface Props {
  event: AgendaItem | null;
  onClose: () => void;
}

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  dateStyle: "long",
});
const timeFmt = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
});

export function EventDrawer({ event, onClose }: Props) {
  const t = useTranslations("gantt.drawer");
  const ta = useTranslations("a11y");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!event) return;
    closeButtonRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [event, onClose]);

  if (!event) return null;

  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-drawer-title"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "var(--sg-surface)",
          borderRadius: "14px 14px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--sg-font-ui)",
        }}
      >
        {/* Tinted header */}
        <div style={{
          padding: 18,
          background: `color-mix(in oklch, ${event.eventTypeColor} 16%, white)`,
          borderBottom: `4px solid ${event.eventTypeColor}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 6, flexShrink: 0,
              background: event.eventTypeColor, color: "white",
              display: "grid", placeItems: "center", fontSize: 14,
            }}>
              {event.eventTypeGlyph}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--sg-ink-mute)",
              letterSpacing: "0.04em", textTransform: "uppercase",
              fontFamily: "var(--sg-font-mono)",
            }}>
              {event.eventTypeLabelHe}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={ta("closeDialog")}
              style={{
                marginInlineStart: "auto",
                width: 28, height: 28, display: "grid", placeItems: "center",
                border: "1px solid var(--sg-hairline)", borderRadius: 6,
                background: "rgba(255,255,255,0.6)", cursor: "pointer",
                fontSize: 14, color: "var(--sg-ink-mute)",
              }}
            >
              ✕
            </button>
          </div>
          <h2
            id="event-drawer-title"
            style={{
              fontFamily: "var(--sg-font-display)", fontSize: 22, fontWeight: 600,
              lineHeight: 1.15, margin: 0, color: "var(--sg-ink)",
            }}
          >
            {event.title}
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: 1 }}>
          <DetailRow label={t("date")} value={dateFmt.format(startDate)} />
          {!event.allDay && (
            <DetailRow
              label="שעות"
              value={`${timeFmt.format(startDate)} – ${timeFmt.format(endDate)}`}
            />
          )}
          {event.grades.length > 0 && (
            <DetailRow
              label={t("grades")}
              value={
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {event.grades.map((g) => (
                    <span key={g} style={{
                      fontFamily: "var(--sg-font-display)", fontSize: 16, fontWeight: 600,
                      background: "var(--sg-surface-2)", border: "1px solid var(--sg-hairline)",
                      borderRadius: 6, padding: "2px 10px",
                    }}>
                      {g}
                    </span>
                  ))}
                </div>
              }
            />
          )}
          {event.location && <DetailRow label={t("location")} value={event.location} />}
          {event.description && <DetailRow label={t("description")} value={event.description} />}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: 8, padding: 14,
          borderTop: "1px solid var(--sg-hairline)",
          background: "var(--sg-surface-2)",
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 32, padding: "0 14px",
              borderRadius: 8, border: "1px solid var(--sg-hairline)",
              background: "transparent", color: "var(--sg-ink-mute)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 12, alignItems: "baseline" }}>
      <dt style={{
        fontSize: 11, color: "var(--sg-ink-soft)", letterSpacing: "0.04em",
        fontFamily: "var(--sg-font-display)", fontWeight: 500,
      }}>
        {label}
      </dt>
      <dd style={{ fontSize: 14, fontWeight: 500, color: "var(--sg-ink)", margin: 0 }}>
        {typeof value === "string"
          ? <span style={{ whiteSpace: "pre-wrap" }}>{value}</span>
          : value}
      </dd>
    </div>
  );
}
