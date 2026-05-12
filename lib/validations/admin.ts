import { z } from "zod";

/**
 * Zod validation schemas for /api/v1/admin/* routes.
 * All admin-facing inputs are validated at the API boundary before reaching domain helpers.
 */

export const StaffUserCreateSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(["editor", "admin"]),
  temporaryPassword: z.string().min(8),
  gradeScopes: z.array(z.number().int().min(7).max(12)).optional(),
  eventTypeScopes: z.array(z.string().min(1).max(64)).optional(),
});

export type StaffUserCreateInput = z.infer<typeof StaffUserCreateSchema>;

export const StaffUserUpdateSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(["editor", "admin"]).optional(),
  deactivated: z.boolean().optional(),
  gradeScopes: z.array(z.number().int().min(7).max(12)).optional(),
  eventTypeScopes: z.array(z.string().min(1).max(64)).optional(),
});

export type StaffUserUpdateInput = z.infer<typeof StaffUserUpdateSchema>;

export const EventTypeSchema = z.object({
  key: z.string().min(1).max(64),
  labelHe: z.string().min(1),
  labelEn: z.string().min(1),
  /** Hex color in #RRGGBB format */
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be #RRGGBB"),
  /** Single glyph or short string for the event type icon */
  glyph: z.string().min(1).max(8),
  sortOrder: z.number().int().min(0).optional(),
});

export type EventTypeInput = z.infer<typeof EventTypeSchema>;

export const AcademicYearSchema = z.object({
  label: z.string().min(1).max(128),
  /** ISO date string YYYY-MM-DD */
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  /** ISO date string YYYY-MM-DD */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  /** When true, also sets schools.active_academic_year_id to the new id */
  setActive: z.boolean().optional(),
});

export type AcademicYearInput = z.infer<typeof AcademicYearSchema>;
