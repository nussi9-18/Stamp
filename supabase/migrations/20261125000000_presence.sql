-- "Now": what a passport holder is watching, reading, playing or listening to right now.
-- One row per user. Readable by the people who follow them; expires on its own.

create table public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  item_id text not null,
  item jsonb,
  label text not null default '' check (char_length(label) <= 40),
  pct smallint check (pct between 0 and 100),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cleared boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create trigger presence_lww before insert or update on public.presence for each row execute function public.stamp_lww();
create index presence_live_idx on public.presence (expires_at) where not cleared;

alter table public.presence enable row level security;

create policy "own presence" on public.presence
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "followers read presence" on public.presence
  for select to authenticated
  using (
    exists (
      select 1 from public.follows f
      where f.user_id = (select auth.uid())
        and f.target = presence.user_id::text
        and not f.deleted
    )
  );
