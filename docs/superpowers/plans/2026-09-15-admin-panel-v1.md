# ARK Tarix Quiz Bot Admin Panel v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished role-aware `/start` flow and Telegram `/admin` panel with quiz management, persistent result browsing, dynamic admins, statistics, and global quiz settings while keeping student self-results out of scope.

**Architecture:** Keep Telegram as the only UI. Add focused database services for admins, settings, results, and statistics, then route all menu/callback flows through `api/telegram/webhook.ts`. Preserve the existing quiz/session engine and result persistence behavior; quiz deletion is archival so historical results remain intact.

**Tech Stack:** TypeScript, Vercel Functions, Telegram Bot API, Supabase/PostgreSQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-admin-panel-v1-design.md`

## Global Constraints

- Super Admins are the IDs in `ADMIN_TELEGRAM_IDS` and cannot be removed through Telegram UI.
- Dynamic admins are persisted in `history_admins`.
- Student self-result/history view is not exposed in this release.
- Quiz/session/result history is preserved; quiz deletion is archival.
- Existing webhook secret validation remains enabled.
- New settings are database-backed and new quizzes inherit them.

---

### Task 1: Database schema for admins and settings

**Files:**
- Create: `supabase/migrations/20260915_history_admin_panel.sql`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Produces tables `history_admins` and `history_settings`.

- [ ] Write a failing schema-content test that requires both tables, role checks, singleton settings row, and RLS.
- [ ] Run `npm test` and confirm the new test fails.
- [ ] Add the migration with `history_admins`, `history_settings`, indexes, RLS, and the default settings row.
- [ ] Run `npm test` and confirm it passes.

### Task 2: Admin authorization service

**Files:**
- Create: `src/history/admin-service.ts`
- Modify: `src/history/auth.ts`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Produces `getAdminAccess(userId, envSuperAdmins)`, `listAdmins`, `addAdmin`, `deactivateAdmin`.
- Access shape: `{ isAdmin: boolean; isSuperAdmin: boolean; role: 'super_admin' | 'admin' | 'user' }`.

- [ ] Add failing tests for env Super Admin priority and dynamic admin role mapping.
- [ ] Run the targeted test and verify RED.
- [ ] Implement pure role resolution plus database CRUD helpers.
- [ ] Run tests and verify GREEN.

### Task 3: Global settings service and quiz defaults

**Files:**
- Create: `src/history/settings-service.ts`
- Modify: `src/history/quiz-service.ts`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Produces `getSettings`, `updateDefaultTime`, `toggleShuffleQuestions`, `toggleShuffleOptions`.
- `createQuizFromText` consumes settings and writes defaults to new quizzes.

- [ ] Add failing tests for default settings normalization and allowed times.
- [ ] Verify test failure.
- [ ] Implement settings service and quiz creation integration.
- [ ] Verify all tests pass.

### Task 4: Admin result and statistics queries

**Files:**
- Create: `src/history/result-service.ts`
- Create: `src/history/stats-service.ts`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Produces `listRecentResults(limit)`, `getResultDetail(sessionId)`, `getAdminStats()`.

- [ ] Add failing formatter/query-shape tests.
- [ ] Verify RED.
- [ ] Implement result/session joins and aggregate-stat helpers via PostgREST.
- [ ] Verify GREEN.

### Task 5: Telegram welcome and admin menus

**Files:**
- Modify: `api/telegram/webhook.ts`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- `/start` renders a personalized welcome.
- `/admin` and `⚙️ Admin panel` render the management menu for admins.
- Student menu does not contain personal results.

- [ ] Add failing tests for welcome copy/menu labels and `/admin` authorization structure.
- [ ] Verify RED.
- [ ] Implement welcome/admin menu builders and command routing.
- [ ] Verify GREEN.

### Task 6: Inline quiz management and delete confirmation

**Files:**
- Modify: `api/telegram/webhook.ts`
- Modify: `src/history/callbacks.ts` only if callback encoding needs expansion.
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Admin quiz list supports open, preview, group, time, start, delete-confirm, archive-confirmed.

- [ ] Add failing tests for destructive-action confirmation callback encoding.
- [ ] Verify RED.
- [ ] Implement quiz management callbacks and confirmation UI.
- [ ] Verify GREEN.

### Task 7: Dynamic admin, settings, results, and stats panel flows

**Files:**
- Modify: `api/telegram/webhook.ts`
- Modify: `src/history/admin-state.ts`
- Test: `tests/admin-panel.test.ts`

**Interfaces:**
- Super Admin can add/remove admins.
- Admin can browse results/statistics/settings.
- Settings actions update DB and redraw settings panel.

- [ ] Add failing state/callback coverage for `awaiting_admin_id` and menu callback labels.
- [ ] Verify RED.
- [ ] Implement the flows with Uzbek success/error messages.
- [ ] Verify GREEN.

### Task 8: Database migration, deployment, and live verification

**Files:**
- No new source files unless verification reveals a defect.

- [ ] Run the full `npm test` suite and require 0 failures.
- [ ] Apply `20260915_history_admin_panel.sql` to Supabase.
- [ ] Commit/push feature changes and deploy through the Git-connected production branch after integration.
- [ ] Verify Vercel deployment is READY.
- [ ] Trigger `/start` and `/admin` paths through real Telegram usage/logs.
- [ ] Verify quiz completion still writes `history_results` and does not expose student personal result lookup.
