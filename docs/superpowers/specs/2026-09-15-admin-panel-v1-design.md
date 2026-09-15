# ARK Tarix Quiz Bot — Admin Panel v1 Design

## Goal

Turn the bot into a role-aware Telegram quiz management system with a polished `/start` welcome flow, a dedicated `/admin` inline panel, persistent quiz results, dynamic admins, quiz management, group management, statistics, and global quiz settings. Student self-result lookup is explicitly out of scope for this version.

## Roles

- **Super Admin**: every Telegram ID in `ADMIN_TELEGRAM_IDS`. These accounts always retain control and cannot be removed from the bot UI.
- **Admin**: stored in `history_admins`; can manage quizzes, groups, sessions, results, statistics, and settings, but cannot add/remove Super Admins.
- **Student/User**: receives the welcome menu and public informational actions only. Personal result lookup is not exposed in this release.

## `/start` Experience

`/start` sends a polished Uzbek welcome message using the Telegram user's first name when available. The base inline menu contains `📚 Quizlar` and `ℹ️ Bot haqida`. Admins additionally receive `⚙️ Admin panel`.

## `/admin` Panel

The admin panel is inline-keyboard driven and contains:

- `➕ Test qo‘shish`
- `📚 Testlar`
- `👥 Guruhlar`
- `🏆 Natijalar`
- `📊 Statistika`
- `👑 Adminlar` (Super Admin only for mutations)
- `⚙️ Sozlamalar`
- `🏠 Bosh menyu`

## Quiz Management

Admins can create quizzes using the existing text parser, list recent quizzes, open a quiz, preview questions, choose a group, choose per-question time, start a session, and archive/delete a quiz after a confirmation prompt. Archiving preserves historical sessions/results.

## Result Persistence

The existing `history_sessions`, `history_players`, `history_answers`, and `history_results` tables remain the source of truth. A completed quiz writes ranked results to `history_results`; previous sessions are browsable from the admin panel. Results are not auto-deleted.

## Admin Management

Create `history_admins` with Telegram ID, display name, role (`admin`), creator ID, timestamps, and active flag. Super Admins are sourced from environment and shown separately. Adding an admin is a two-step flow: press `➕ Admin qo‘shish`, then send numeric Telegram ID. Removing an admin requires confirmation.

## Global Settings

Create singleton `history_settings` row for:

- default per-question time (10/15/20/30/45/60 seconds)
- shuffle questions on/off
- shuffle options on/off

New quizzes inherit these settings. Existing quiz-specific values remain editable through the quiz preview.

## Statistics

Admin statistics show total quizzes, registered groups, completed sessions, unique players, and stored answers. The first version keeps this concise and database-backed.

## Safety and Error Handling

- Only Admin/Super Admin can open `/admin`.
- Only Super Admin can mutate admins.
- Super Admin IDs from environment cannot be removed.
- Delete actions require confirmation.
- Database-backed actions return friendly Uzbek error messages rather than exposing internal errors.
- Existing webhook secret validation remains unchanged.

## Out of Scope

- Student personal result/history screen.
- Web admin dashboard.
- Scheduled quiz starts.
- File/image based quiz authoring.
