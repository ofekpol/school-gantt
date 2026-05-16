import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["editor", "admin", "viewer"]);
export const staffStatusEnum = pgEnum("staff_status", ["pending", "active", "deactivated"]);
export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
]);
export const scopeKindEnum = pgEnum("scope_kind", ["grade", "event_type"]);

// ─── RLS helper ───────────────────────────────────────────────────────────────

const schoolIsolation = pgPolicy("school_isolation", {
  as: "permissive",
  for: "all",
  using: sql`school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid`,
  withCheck: sql`school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid`,
});

// ─── Tables ───────────────────────────────────────────────────────────────────

/** Tenant root — no RLS (schools table is the tenant anchor). */
export const schools = pgTable("schools", {
  id: uuid().defaultRandom().primaryKey(),
  slug: varchar({ length: 64 }).notNull().unique(),
  name: text().notNull(),
  locale: varchar({ length: 8 }).notNull().default("he"),
  timezone: varchar({ length: 64 }).notNull().default("Asia/Jerusalem"),
  /** Nullable FK to academic_years; set after year is inserted to avoid circular. */
  activeAcademicYearId: uuid("active_academic_year_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid().defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [schoolIsolation],
);

/**
 * Staff users — id mirrors auth.users.id (no defaultRandom; set explicitly during seed).
 * Pitfall 6: loginAttempts is required for AUTH-03 10-attempt lockout.
 */
export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid().primaryKey(), // NO defaultRandom — receives auth.users.id from seed
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    email: varchar({ length: 255 }).notNull().unique(),
    fullName: text("full_name").notNull(),
    role: roleEnum().notNull().default("editor"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    loginAttempts: integer("login_attempts").notNull().default(0),
    status: staffStatusEnum().notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  () => [schoolIsolation],
);

export const editorScopes = pgTable(
  "editor_scopes",
  {
    id: uuid().defaultRandom().primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    scopeKind: scopeKindEnum("scope_kind").notNull(),
    scopeValue: varchar("scope_value", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    schoolIsolation,
    uniqueIndex("editor_scopes_unique_idx").on(
      t.staffUserId,
      t.scopeKind,
      t.scopeValue,
    ),
    index("editor_scopes_staff_user_idx").on(t.staffUserId),
  ],
);

export const staffInvites = pgTable(
  "staff_invites",
  {
    id: uuid().defaultRandom().primaryKey(),
    token: uuid().defaultRandom().notNull().unique(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    role: roleEnum().notNull().default("editor"),
    gradeScopes: integer("grade_scopes").array().notNull().default(sql`'{}'::integer[]`),
    eventTypeScopes: text("event_type_scopes").array().notNull().default(sql`'{}'::text[]`),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: uuid("used_by").references(() => staffUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    schoolIsolation,
    index("staff_invites_school_idx").on(t.schoolId),
  ],
);

export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid().defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    key: varchar({ length: 64 }).notNull(),
    labelHe: text("label_he").notNull(),
    labelEn: text("label_en").notNull(),
    colorHex: varchar("color_hex", { length: 7 }).notNull(),
    glyph: varchar({ length: 8 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    schoolIsolation,
    uniqueIndex("event_types_school_key_idx").on(t.schoolId, t.key),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid().defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id),
    title: text().notNull(),
    description: text(),
    location: text(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    status: eventStatusEnum().notNull().default("draft"),
    version: integer().notNull().default(1),
    /** Self-referential FK for revision-of-approved events. */
    parentEventId: uuid("parent_event_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    schoolIsolation,
    index("events_school_status_idx").on(t.schoolId, t.status),
    index("events_school_start_idx").on(t.schoolId, t.startAt),
  ],
);

/** Composite PK; school_id denormalized for RLS. */
export const eventGrades = pgTable(
  "event_grades",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    grade: integer().notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.grade] }),
    schoolIsolation,
  ],
);

export const eventRevisions = pgTable(
  "event_revisions",
  {
    id: uuid().defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    snapshot: jsonb().notNull(),
    submittedBy: uuid("submitted_by").references(() => staffUsers.id),
    decidedBy: uuid("decided_by").references(() => staffUsers.id),
    decision: varchar({ length: 16 }),
    reason: text(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    schoolIsolation,
    index("event_revisions_event_created_idx").on(t.eventId, t.createdAt),
  ],
);

export const icalSubscriptions = pgTable(
  "ical_subscriptions",
  {
    id: uuid().defaultRandom().primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    token: varchar({ length: 64 }).notNull().unique(),
    filterGrades: integer("filter_grades").array().notNull().default(sql`'{}'::integer[]`),
    filterEventTypes: uuid("filter_event_types").array().notNull().default(sql`'{}'::uuid[]`),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  () => [schoolIsolation],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().defaultRandom().primaryKey(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    actorStaffId: uuid("actor_staff_id").references(() => staffUsers.id),
    action: varchar({ length: 64 }).notNull(),
    targetTable: varchar("target_table", { length: 64 }).notNull(),
    targetId: uuid("target_id"),
    payload: jsonb(),
    at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    schoolIsolation,
    index("audit_log_school_at_idx").on(t.schoolId, t.at),
  ],
);

export const pendingRegistrations = pgTable("pending_registrations", {
  id: uuid().defaultRandom().primaryKey(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  googleAvatarUrl: text("google_avatar_url"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => staffUsers.id),
  reviewOutcome: varchar("review_outcome", { length: 16 }),
});
