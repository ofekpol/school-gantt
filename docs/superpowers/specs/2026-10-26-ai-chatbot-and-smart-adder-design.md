# AI Features: Staff Chatbot + Smart Event Adder — Design

Date: 2026-10-26
Branch: `feature/staging-dev` (cut from `origin/staging`). **Do not merge** anywhere until the owner says so. Develop and test only against the staging Supabase project (`oxvgypstprwtphqhnpck`); never against prod (`mfrtdirkknuvweaiqfzs`).

## Why

Staff spend time hunting through the calendar to answer simple questions ("what does ח׳ have next week?") and entering events one by one through the wizard. Two light AI helpers cut that down:

1. **Staff chatbot** — answers Hebrew questions about the school's own events and data.
2. **Smart event adder** — turns pasted/typed Hebrew text describing one or more events into reviewed, publishable events.

Success: an editor pastes a message with several events, fixes anything flagged, and publishes them in under a minute; staff get correct Hebrew answers about the calendar without leaving the dashboard.

## Goals

- Both features work in Hebrew, RTL, through `next-intl` (`messages/he.json` first, `en.json` mirror).
- Free (or near-free) and light model.
- Staff only. Nothing exposed on public routes.
- Strictly scoped to this app's purpose; cannot be used as a general-purpose AI.
- Nothing is written to the calendar without explicit user confirmation.

## Non-goals

- Public-visitor chatbot.
- Chatbot editing/creating/deleting data (it is read-only).
- Adder editing existing events (it only creates new ones; existing ones are edited from the calendar).
- Chat history persistence across sessions (in-memory per panel session is enough).
- English-language parsing of event text (Hebrew is the target; English UI strings still mirrored).

## Anti-goals (failure even if it "works")

- Any AI path that can read another school's data.
- The AI guessing missing values silently (dates, years, grades, times, event type).
- Duplicate events created because the user didn't notice.
- The chat or adder being usable as a free general LLM (essays, translation, code, etc.).
- Any change touching the prod database or `main`.

## Constraints

- All CLAUDE.md rules apply: `withSchool` for every school query, Zod at every API boundary, no `any`, logical CSS properties only, strings via `t()`, dates via `lib/datetime.ts` (Asia/Jerusalem), files < 400 lines, functions < 50 lines.
- `pnpm build` runs `scripts/migrate.ts` first. This design needs **no schema change and no migration**. If the builder finds one is truly necessary, stop and ask the owner first.
- New dependency set: Vercel AI SDK (`ai`) + a Groq provider (`@ai-sdk/groq`). Verify APIs against the installed package docs, not memory.
- Secret: `GROQ_API_KEY` in `.env.local` (owner creates it; Claude never handles the value). Add the name to `.env.example` and to the env list in CLAUDE.md.

## Decided by the owner

- **Audience:** staff only, for both features.
- **Model:** Groq free tier. Provider must be swappable via one place (e.g. `lib/ai/model.ts`) so moving to Gemini or another provider is a one-line change.
- **Dates:** always day-month-year (Israeli order), in mixed formats: `12/11/26`, `3.12`, `15.12.2026`, `1/1`, with `/`, `.`, or `-`.
- **Missing info is never guessed.** Any required field the text doesn't provide (date, year, grades, time/all-day choice, or an event type the AI isn't confident about) shows as empty with a Hebrew prompt, and that event cannot be published until filled.
- **Review screen = "Option A" editable cards.** One card per detected event, checkbox to include, `✏️ ערוך` opens all fields inline (title, event type, date, start/end time or all-day, grades, location, description). All warnings in Hebrew, RTL. Mockup: `.superpowers/brainstorm/32645-1793037407/content/smart-adder-confirm-v2.html` (local only, not committed).
- **Duplicates:** if an event with the same title and date already exists (visible to the user), the card says so in Hebrew, links to the existing event for editing in the calendar, and starts **unchecked**.
- **Overlaps:** if a new event's time overlaps an existing event, show a Hebrew warning naming the other event. It does **not** block publishing; the user can publish or edit.
- **Misuse prevention** is required for both features (details below were proposed and accepted).

## Accepted proposals (Claude's calls, approved as a set)

- Chatbot: all logged-in active staff (editor, admin, viewer). Adder: editors and admins only (same rule as `/api/v1/events/publish`).
- Overlap = time ranges intersect **and** at least one shared grade.
- Daily per-user limits: ~50 chat messages, ~20 adder requests. Input cap ~3,000 chars for the adder; ~500 chars per chat message.
- Every AI call writes an `audit_log` row (actor, action, timestamp; no full prompt text needed beyond a short length/summary).
- Placement: chatbot as a floating button on all `(staff)` pages opening a side panel (inline-end side); adder as a `הוספה חכמה ✨` button on the dashboard next to the existing new-event entry point.

## How it works

### Shared AI layer (`lib/ai/`)

- `model.ts` — the single place the provider/model is chosen (reads `GROQ_API_KEY`; model id from an env var with a code default).
- `limits.ts` — daily quota check by counting today's (Asia/Jerusalem) `audit_log` rows with `action in ('ai_chat','ai_parse_events')` for the actor, inside `withSchool`. Over limit → 429 with a Hebrew message key. No new table.
- `audit.ts` — writes the audit row.
- If `GROQ_API_KEY` is missing, both features hide their buttons and the routes return 503; the rest of the app is unaffected.

### Chatbot

- Route: `POST /api/v1/ai/chat` (auth via `getStaffUser`; active staff only). Request: last N messages (Zod-validated, length-capped). Streams the answer.
- The model never gets raw DB access. It gets a small set of **read-only tools**, each running inside `withSchool(user.schoolId, …)`:
  - search/list events by date range, grade(s), event type, free-text title match (approved, not deleted);
  - list event types;
  - school info (name, active academic year dates);
  - simple counts (events per type/grade/month).
  Tool results return only the fields needed (title, dates, grades, type label, location).
- System prompt (Hebrew-first): answer only about this school's calendar/data using the tools; for anything else reply with a fixed Hebrew refusal; never invent events; dates shown as DD/MM/YYYY in Asia/Jerusalem; today's date is injected server-side.
- Hard caps: max tool-call steps per answer, max output tokens.
- UI: client component panel, RTL, message list + input; strings via `t()`.

### Smart event adder

1. **Parse** — `POST /api/v1/ai/parse-events` (editors/admins). Input: text (≤ ~3,000 chars). The model is called with **structured output only** (Zod schema): an array of `{ title, dateText, day?, month?, year?, startTime?, endTime?, allDay?, gradesMentioned[], eventTypeKey?, typeConfidence, location?, description? }`. No free-text reply path exists, so it can't be used as a chatbot. Model is given today's date, the school's event types (key + Hebrew label) and the grade labels (ז–יב, "כל השכבות").
2. **Normalize on the server (deterministic, unit-tested)** — the server, not the model, turns the extracted parts into dates/times via `lib/datetime.ts`: validates day/month ranges and real calendar dates; a missing year stays empty (flagged), never inferred; grades mapped to 7–12; "all grades" expanded; event type must exist in the school's list and be allowed for the user (`isEventTypeAllowed`) else empty + flagged; low type confidence → empty + flagged.
3. **Check against the calendar** — inside `withSchool`, for each candidate: duplicate check (same normalized title + same date) and overlap check (time intersect + shared grade). Grades outside the editor's scope (`getEditorAllowedGrades`) are marked.
4. **Respond** — list of candidates with fields, per-field missing flags, and warning codes (`missing_date`, `missing_year`, `missing_grades`, `missing_time`, `uncertain_type`, `duplicate{eventId}`, `overlap{eventId,title,grades,time}`, `grade_out_of_scope{grades}`). Codes are translated to Hebrew in the UI via `he.json`.
5. **Review UI** — Option A cards. Cards with missing fields can't be checked until filled. Duplicates start unchecked with a link to the existing event. Out-of-scope grades shown struck-through and dropped on publish unless removed/fixed. Footer button: `פרסם N אירועים` (N = checked, complete).
6. **Publish** — the client calls the existing `POST /api/v1/events/publish` once per checked event (same validation, scope checks, revision row, cache invalidation as today). Show per-event success/failure; failures stay on screen for fixing.
7. If the model returns nothing usable → Hebrew "לא נמצאו אירועים בטקסט".

### Misuse prevention (summary)

Staff-only auth on both routes; role checks; per-user daily quotas; input length caps; adder is structured-output only; chatbot restricted by system prompt + read-only, school-scoped tools + fixed refusal; step/token caps; audit rows for every call; no AI route under public paths.

## Testing

- Unit (Vitest): date/time normalization (all listed formats, invalid dates, missing year), grade mapping, warning computation, quota counting, Zod schemas.
- Integration (real staging-like Postgres per repo convention): tools only return the caller's school (cross-school denial), duplicate/overlap queries, quota counting from `audit_log`.
- The model itself is mocked in unit/integration tests (fixed structured outputs); a small manual eval script in `scripts/` runs a set of real Hebrew samples against Groq to pick the model.
- E2E (Playwright): adder flow with a mocked AI response — paste → review → edit a flagged card → publish → event appears.

## Calls settled during review (Claude's, flagged for the owner)

- **Multi-day events** ("טיול 12-14/11/26"): supported. The schema carries an optional end date, and the review card has the existing multi-day toggle (as in `QuickEventDialog`).
- **Start time without end time** counts as missing (flagged, user fills it). This follows "anything empty → ask".
- **Duplicate/overlap checks** compare against approved, non-deleted events of the school. Drafts are ignored.
- **Chat context:** the client sends at most the last 10 messages, and history is lost when the panel closes or the page reloads.
- **Recurring events** ("כל יום ראשון") are out of scope. The adder flags them as unclear instead of expanding them.

## Left to the builder

- Exact Groq model (test 2–3 of the larger tool-capable models on Hebrew samples; pick the best Hebrew quality that supports structured output + tools).
- Exact quota numbers and caps within the stated ranges.
- Component breakdown and file names, following existing `components/dashboard` patterns and `QuickEventDialog` field handling.
- Whether chat streams token-by-token or returns whole answers (streaming preferred).
