import { z } from "zod";

/**
 * All-optional schema for PATCH autosave requests — allows partial saves at every wizard step.
 * See RESEARCH Pitfall 1: never require all fields on PATCH (blocks wizard advance).
 */
export const EventDraftSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  location: z.string().max(255).optional(),
  startAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  allDay: z.boolean().optional(),
  eventTypeId: z.string().uuid().optional(),
  grades: z.array(z.number().int().min(7).max(12)).optional(),
});

export type EventDraftInput = z.infer<typeof EventDraftSchema>;

/**
 * Strict schema for POST /submit — all required fields must be present.
 * Validated at the submit step (Step 7), not during autosave.
 */
export const EventSubmitSchema = z.object({
  title: z.string().min(1).max(255),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  eventTypeId: z.string().uuid(),
  grades: z.array(z.number().int().min(7).max(12)).min(1),
});

export type EventSubmitInput = z.infer<typeof EventSubmitSchema>;

/**
 * Reject reason payload — admin must explain rejection (PRD §6.3).
 * Editor sees this on /dashboard/rejected.
 */
export const RejectSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export type RejectInput = z.infer<typeof RejectSchema>;

/**
 * Filters captured when a staff user creates an iCal subscription.
 * Empty arrays mean "no filter on this axis" (i.e. include all).
 */
export const ICalSubscriptionSchema = z.object({
  grades: z.array(z.number().int().min(7).max(12)).max(6).optional(),
  eventTypes: z.array(z.string().uuid()).max(50).optional(),
});

export type ICalSubscriptionInput = z.infer<typeof ICalSubscriptionSchema>;
