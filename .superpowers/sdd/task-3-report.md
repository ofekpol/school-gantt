# Task 3: Hidden-tab polling and focused API loader

## Implementation

- Added the pure `shouldPollPublicViewer` helper and used it to stop the five-second public refresh interval while the document is hidden.
- The shell performs one signature refresh when visibility returns, then resumes its normal visible-tab interval.
- Replaced the events endpoint's full-viewer-data dependency with an events-only five-second cached loader. It retains the existing `public-viewer:<slug>` cache tag, so current publish/edit invalidation continues to evict both payloads.

## Test-first evidence

- Added failing tests for visible-document polling eligibility and events-only payload loading.
- Red: `corepack pnpm vitest run test/unit/views/public-viewer.test.ts test/unit/views/public-viewer-data.test.ts` failed because the helper was missing and the endpoint loader invoked the full viewer data path.
- Green: the same focused tests pass after implementation.

## Verification

- `corepack pnpm vitest run test/unit/views/public-viewer.test.ts test/unit/views/public-viewer-data.test.ts` — 12 passed
- `corepack pnpm test:unit` — 42 passed, 1 skipped; 304 passed, 3 skipped
- `corepack pnpm tsc --noEmit` — passed

## Scope

No API response schema, event mutation invalidation, database query, or RLS behavior changed.
