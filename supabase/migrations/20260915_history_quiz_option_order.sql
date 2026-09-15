alter table public.history_sessions
  add column if not exists current_option_order text[] not null
  default array['A','B','C','D']::text[];
