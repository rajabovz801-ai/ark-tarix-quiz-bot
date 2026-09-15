# ARK Tarix Quiz Bot

Telegram history quiz bot for `@ark_tarix_quiz_bot`.

## What it does

- Admin sends quiz text privately to the bot.
- Bot validates and previews A/B/C/D questions.
- Admin selects a registered Telegram group and timer (10/15/20/30/45/60 sec).
- Bot sends native Telegram quiz polls one by one.
- Polls close automatically; the next question starts automatically.
- Student answers, score, speed bonus, leaderboard and analytics are saved in Supabase.
- Existing ARK database tables are untouched; this app uses only `history_*` tables.

## Quiz input

```text
Quiz: Amir Temur

1. Amir Temur qachon tug‘ilgan?
A) 1336
B) 1338
C) 1340
D) 1342
Javob: A
```

You can send `/newquiz`, or simply send text beginning with `Quiz:`.

## Group setup

1. Add the bot to the Telegram group.
2. Make sure the bot can send polls/messages.
3. An admin sends `/registergroup` inside the group.
4. The group then appears in the bot's private admin menu.

## Environment variables

```text
TELEGRAM_BOT_TOKEN=
ADMIN_TELEGRAM_IDS=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_WEBHOOK_SECRET=
SETUP_SECRET=
```

Never commit real values. `ADMIN_TELEGRAM_IDS` is a comma-separated list of numeric Telegram user IDs. Before admin is configured, `/id` in a private chat returns your numeric ID.

## Webhook setup

After deployment, call:

```text
POST https://YOUR_DOMAIN/api/telegram/setup
Authorization: Bearer <SETUP_SECRET>
```

This registers `/api/telegram/webhook` with Telegram and subscribes to messages, callback queries, polls and poll answers.

## Local verification

```bash
npm test
```

The project intentionally has no runtime npm dependencies; it uses Node `fetch`, Vercel Functions, Telegram Bot API and Supabase PostgREST.

## Database

Migration: `supabase/migrations/20260915_history_quiz_bot.sql`

Tables:

- `history_quizzes`
- `history_questions`
- `history_groups`
- `history_sessions`
- `history_players`
- `history_answers`
- `history_results`
- `history_bot_state`
