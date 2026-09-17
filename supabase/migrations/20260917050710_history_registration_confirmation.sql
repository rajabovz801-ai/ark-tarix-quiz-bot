begin;

alter table public.history_bot_state
  drop constraint if exists history_bot_state_state_check;

alter table public.history_bot_state
  add constraint history_bot_state_state_check
  check (state in (
    'idle',
    'awaiting_quiz',
    'preview',
    'choosing_group',
    'choosing_time',
    'awaiting_admin_id',
    'awaiting_first_name',
    'awaiting_last_name',
    'awaiting_confirmation'
  ));

commit;
