"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Step1Date } from "./Step1Date";
import { Step2Grades } from "./Step2Grades";
import { Step3EventType } from "./Step3EventType";
import { Step4Title } from "./Step4Title";
import { Step5Time } from "./Step5Time";
import { Step6Responsible } from "./Step6Responsible";
import { Step7Summary } from "./Step7Summary";

export interface EventType {
  id: string;
  key: string;
  labelHe: string;
  colorHex: string;
  glyph: string;
}

export interface WizardShellProps {
  yearBounds: { startDate: string; endDate: string } | null;
  eventTypes: EventType[];
  allowedGrades: number[];
  resumeDraft: Record<string, unknown> | null;
  resumeId: string | null;
}

export interface WizardData {
  date?: string;
  grades?: number[];
  eventTypeId?: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  responsibleText?: string;
  requirementsText?: string;
}

export interface StepProps {
  data: WizardData;
  saving: boolean;
  onNext: (d: WizardData) => Promise<void>;
  onBack: () => void;
}

const TOTAL_STEPS = 7;

/**
 * WizardShell — client-side orchestrator for the 7-step event creation wizard.
 * Autosaves to the API after every step (WIZARD-02).
 * On submit, calls POST /api/v1/events/:id/submit (WIZARD-06).
 */
export function WizardShell({
  yearBounds,
  eventTypes,
  allowedGrades,
  resumeDraft,
  resumeId,
}: WizardShellProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [eventId, setEventId] = useState<string | null>(resumeId);
  const [data, setData] = useState<WizardData>(() => {
    if (!resumeDraft) return {};
    return {
      title: typeof resumeDraft.title === "string" ? resumeDraft.title : undefined,
      startAt:
        typeof resumeDraft.startAt === "string"
          ? new Date(resumeDraft.startAt).toISOString()
          : undefined,
      endAt:
        typeof resumeDraft.endAt === "string"
          ? new Date(resumeDraft.endAt).toISOString()
          : undefined,
      allDay: typeof resumeDraft.allDay === "boolean" ? resumeDraft.allDay : false,
      eventTypeId:
        typeof resumeDraft.eventTypeId === "string" ? resumeDraft.eventTypeId : undefined,
    };
  });
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (patch: WizardData): Promise<string> => {
      setSaving(true);
      try {
        if (!eventId) {
          const res = await fetch("/api/v1/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error("Failed to create draft");
          const json = (await res.json()) as { id: string };
          setEventId(json.id);
          return json.id;
        } else {
          const res = await fetch(`/api/v1/events/${eventId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error("Failed to save step");
          return eventId;
        }
      } finally {
        setSaving(false);
      }
    },
    [eventId],
  );

  const handleNext = useCallback(
    async (stepData: WizardData) => {
      const merged = { ...data, ...stepData };
      setData(merged);
      await save(merged);
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    },
    [data, save],
  );

  const handleBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const handleSubmit = useCallback(async () => {
    if (!eventId) return;
    const res = await fetch(`/api/v1/events/${eventId}/submit`, { method: "POST" });
    if (!res.ok) throw new Error("Submit failed");
    router.push("/dashboard");
  }, [eventId, router]);

  const stepProps: StepProps = { data, onNext: handleNext, onBack: handleBack, saving };

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <StepProgress current={step} total={TOTAL_STEPS} />
        {step === 1 && <Step1Date {...stepProps} yearBounds={yearBounds} />}
        {step === 2 && <Step2Grades {...stepProps} allowedGrades={allowedGrades} />}
        {step === 3 && <Step3EventType {...stepProps} eventTypes={eventTypes} />}
        {step === 4 && <Step4Title {...stepProps} />}
        {step === 5 && <Step5Time {...stepProps} />}
        {step === 6 && <Step6Responsible {...stepProps} />}
        {step === 7 && (
          <Step7Summary
            {...stepProps}
            eventTypes={eventTypes}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </main>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < current ? "bg-blue-600" : "bg-neutral-200"}`}
        />
      ))}
      <span className="ms-2 text-sm text-neutral-500">
        {current}/{total}
      </span>
    </div>
  );
}
