-- ADMIN-only password recovery support for Meteoro Smart Navigator.
-- The application stores no plaintext recovery tokens. Supabase Auth owns the
-- emailed one-time token; this table records request state and the hash of the
-- exchanged access token so the Meteoro reset endpoint can be used only once.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meteoro_users_recovery_email_admin_only'
      and conrelid = 'public.meteoro_users'::regclass
  ) then
    alter table public.meteoro_users
      add constraint meteoro_users_recovery_email_admin_only
      check (
        recovery_email is null
        or (role = 'admin' and username = 'carlosebarona')
      );
  end if;
end
$$;

create unique index if not exists meteoro_users_recovery_email_unique
  on public.meteoro_users (lower(recovery_email))
  where recovery_email is not null;

create table if not exists public.meteoro_password_recovery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.meteoro_users(id) on delete cascade,
  auth_user_id uuid,
  status text not null default 'requested'
    check (status in (
      'requested',
      'email_sent',
      'email_failed',
      'processing',
      'completed',
      'superseded',
      'expired',
      'failed'
    )),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  used_at timestamptz,
  completed_at timestamptz,
  invalidated_at timestamptz,
  access_token_hash text unique,
  created_at timestamptz not null default now()
);

comment on table public.meteoro_password_recovery is
  'ADMIN-only recovery request state. Supabase Auth sends and validates the one-time email token; only its exchanged access-token hash is retained.';

create index if not exists meteoro_password_recovery_user_requested_idx
  on public.meteoro_password_recovery (user_id, requested_at desc);

create index if not exists meteoro_password_recovery_active_idx
  on public.meteoro_password_recovery (user_id, expires_at desc)
  where status in ('requested', 'email_sent', 'processing');

alter table public.meteoro_password_recovery enable row level security;

revoke all on table public.meteoro_password_recovery from public, anon, authenticated;
