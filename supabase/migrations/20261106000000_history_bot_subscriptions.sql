create table public.history_bot_subscriptions (
  telegram_user_id bigint primary key,
  status text not null default 'pending' check (status in ('pending', 'paid', 'center')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  approved_by bigint,
  check ((status = 'paid') = (expires_at is not null)),
  check ((status = 'pending') = (approved_by is null))
);

alter table public.history_bot_subscriptions enable row level security;
revoke all on public.history_bot_subscriptions from public, anon, authenticated;
grant select, insert, update on public.history_bot_subscriptions to service_role;
