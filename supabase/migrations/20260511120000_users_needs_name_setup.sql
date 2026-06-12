-- Run in Supabase SQL editor if you do not use the CLI migrator.
alter table public.users
  add column if not exists needs_name_setup boolean not null default false;

comment on column public.users.needs_name_setup is
  'When true, app redirects non-Google users to /settings/name until they set a display name.';
