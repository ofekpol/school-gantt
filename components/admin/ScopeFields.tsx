"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatGradeLabel } from "@/lib/grades";
import { cn } from "@/lib/utils";

export const ALL_GRADES = [7, 8, 9, 10, 11, 12];
const EMPTY_GRADES: number[] = [];
const EMPTY_EVENT_TYPES: string[] = [];

interface EventTypeRow {
  key: string;
  labelHe: string;
}

interface ScopeFieldsProps {
  eventTypes: EventTypeRow[];
  gradeName: (grade: number) => string;
  typeName: (key: string) => string;
  defaultGradeScopes?: number[];
  defaultEventTypeScopes?: string[];
  labels: {
    gradeScopes: string;
    eventTypeScopes: string;
    selectAllGrades: string;
    clearAllGrades: string;
    selectAllEventTypes: string;
    clearAllEventTypes: string;
  };
  fieldsetClassName?: string;
  legendClassName?: string;
  optionClassName?: string;
  wrapperClassName?: string;
}

export function ScopeFields({
  eventTypes,
  gradeName,
  typeName,
  defaultGradeScopes = EMPTY_GRADES,
  defaultEventTypeScopes = EMPTY_EVENT_TYPES,
  labels,
  fieldsetClassName,
  legendClassName,
  optionClassName,
  wrapperClassName,
}: ScopeFieldsProps) {
  const [gradeScopes, setGradeScopes] = useState(defaultGradeScopes);
  const [eventTypeScopes, setEventTypeScopes] = useState(defaultEventTypeScopes);

  useEffect(() => {
    setGradeScopes(defaultGradeScopes);
    setEventTypeScopes(defaultEventTypeScopes);
  }, [defaultEventTypeScopes, defaultGradeScopes]);

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", wrapperClassName)}>
      <ScopeGroup
        title={labels.gradeScopes}
        toggleLabel={
          gradeScopes.length === ALL_GRADES.length ? labels.clearAllGrades : labels.selectAllGrades
        }
        onToggleAll={() =>
          setGradeScopes((current) =>
            current.length === ALL_GRADES.length ? [] : [...ALL_GRADES],
          )
        }
        fieldsetClassName={fieldsetClassName}
        legendClassName={legendClassName}
      >
        {ALL_GRADES.map((grade) => (
          <label
            key={grade}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm",
              optionClassName,
            )}
          >
            <input
              type="checkbox"
              name={gradeName(grade)}
              checked={gradeScopes.includes(grade)}
              onChange={(event) =>
                setGradeScopes((current) =>
                  event.target.checked
                    ? [...current, grade]
                    : current.filter((value) => value !== grade),
                )
              }
            />
            {formatGradeLabel(grade)}
          </label>
        ))}
      </ScopeGroup>

      <ScopeGroup
        title={labels.eventTypeScopes}
        toggleLabel={
          eventTypes.length > 0 && eventTypeScopes.length === eventTypes.length
            ? labels.clearAllEventTypes
            : labels.selectAllEventTypes
        }
        onToggleAll={() =>
          setEventTypeScopes((current) =>
            current.length === eventTypes.length ? [] : eventTypes.map((eventType) => eventType.key),
          )
        }
        fieldsetClassName={fieldsetClassName}
        legendClassName={legendClassName}
      >
        {eventTypes.map((eventType) => (
          <label
            key={eventType.key}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-sm",
              optionClassName,
            )}
          >
            <input
              type="checkbox"
              name={typeName(eventType.key)}
              checked={eventTypeScopes.includes(eventType.key)}
              onChange={(event) =>
                setEventTypeScopes((current) =>
                  event.target.checked
                    ? [...current, eventType.key]
                    : current.filter((value) => value !== eventType.key),
                )
              }
            />
            {eventType.labelHe}
          </label>
        ))}
      </ScopeGroup>
    </div>
  );
}

function ScopeGroup({
  title,
  toggleLabel,
  onToggleAll,
  children,
  fieldsetClassName,
  legendClassName,
}: {
  title: string;
  toggleLabel: string;
  onToggleAll: () => void;
  children: ReactNode;
  fieldsetClassName?: string;
  legendClassName?: string;
}) {
  return (
    <fieldset className={fieldsetClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className={cn("text-sm font-medium text-neutral-800", legendClassName)}>
          {title}
        </legend>
        <Button type="button" variant="outline" size="sm" onClick={onToggleAll}>
          {toggleLabel}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
