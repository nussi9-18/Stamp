-- STAMP — accounts, passports, stamps and the social layer (§3.5).
-- Every table has Row Level Security: a user reads and writes only their own rows;
-- dispatches and public passport fields are readable by the people who follow you.
-- Sync is offline-first: clients write `updated_at` (their clock) and a trigger keeps
-- the newer write (last-write-wins) and stamps `synced_at` with the server clock,
-- which clients use as their pull watermark.

create extension if not exists pgcrypto;

/* ── Last-write-wins guard ─────────────────────────────────────────────── */

create or replace function public.stamp_lww()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- an older write arrived late: keep the newer row untouched
  end if;
  new.synced_at := now();
  return new;
end;
$$;

/* ── Passports ─────────────────────────────────────────────────────────── */

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  passport_no text not null unique check (passport_no ~ '^STMP-[0-9]{4}$'),
  issued date not null default current_date,
  affinities text[] not null default '{}' check (cardinality(affinities) <= 3),
  shield jsonb not null default '{"preset":"open","limits":[3,3,3,3,3,3,3,3],"action":"blur"}'::jsonb,
  theme text not null default 'day' check (theme in ('day', 'night')),
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

/* ── Catalog (seeded, read-only for clients) ───────────────────────────── */

create table public.items (
  id text primary key,
  kind text not null check (kind in ('film', 'series', 'book', 'manga', 'game', 'album')),
  title text not null,
  year int,
  by text not null default '',
  mins int,
  cc text,
  v smallint[] check (v is null or cardinality(v) = 8),
  log text not null default ''
);

/* ── Per-user records ──────────────────────────────────────────────────── */

create table public.custom_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  item jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.stamps (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  rating smallint not null check (rating between 0 and 5),
  tags text[] not null default '{}',
  date date not null,
  place text not null check (place in ('home', 'out', 'event')),
  note text not null default '' check (char_length(note) <= 240),
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.canon (
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 1 and 9),
  item_id text,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, position)
);

create table public.wishlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- target: a passport id (uuid as text) or a sample citizen id ('lina', 'marcus', …)
create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  target text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, target)
);

create table public.likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  dispatch_id text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, dispatch_id)
);

-- Public stamp events for followers' feeds (one per stamped work).
create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item jsonb,
  rating smallint not null check (rating between 0 and 5),
  place text not null check (place in ('home', 'out', 'event')),
  note text not null default '' check (char_length(note) <= 240),
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

/* ── Triggers & indexes ────────────────────────────────────────────────── */

create trigger profiles_lww before insert or update on public.profiles for each row execute function public.stamp_lww();
create trigger custom_items_lww before insert or update on public.custom_items for each row execute function public.stamp_lww();
create trigger stamps_lww before insert or update on public.stamps for each row execute function public.stamp_lww();
create trigger canon_lww before insert or update on public.canon for each row execute function public.stamp_lww();
create trigger wishlist_lww before insert or update on public.wishlist for each row execute function public.stamp_lww();
create trigger follows_lww before insert or update on public.follows for each row execute function public.stamp_lww();
create trigger likes_lww before insert or update on public.likes for each row execute function public.stamp_lww();

create index stamps_sync_idx on public.stamps (user_id, synced_at);
create index custom_items_sync_idx on public.custom_items (user_id, synced_at);
create index canon_sync_idx on public.canon (user_id, synced_at);
create index wishlist_sync_idx on public.wishlist (user_id, synced_at);
create index follows_sync_idx on public.follows (user_id, synced_at);
create index follows_target_idx on public.follows (target) where not deleted;
create index likes_sync_idx on public.likes (user_id, synced_at);
create index dispatches_user_idx on public.dispatches (user_id, updated_at desc);

/* ── Row Level Security ────────────────────────────────────────────────── */

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.custom_items enable row level security;
alter table public.stamps enable row level security;
alter table public.canon enable row level security;
alter table public.wishlist enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.dispatches enable row level security;

create policy "own passport" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "catalog is public" on public.items
  for select to anon, authenticated using (true);

create policy "own custom items" on public.custom_items
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own stamps" on public.stamps
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own canon" on public.canon
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own wishlist" on public.wishlist
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own follows" on public.follows
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own likes" on public.likes
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own dispatches" on public.dispatches
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "followers read dispatches" on public.dispatches
  for select to authenticated
  using (
    exists (
      select 1 from public.follows f
      where f.user_id = (select auth.uid())
        and f.target = dispatches.user_id::text
        and not f.deleted
    )
  );

/* ── Public passport fields ────────────────────────────────────────────── */

-- Name, number, tastes and canonical nine of the passports you follow.
create or replace function public.passport_cards(ids uuid[])
returns table (id uuid, name text, passport_no text, affinities text[], canon text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.passport_no, p.affinities,
         coalesce(array(
           select c.item_id from public.canon c
           where c.user_id = p.id and c.item_id is not null
           order by c.position
         ), '{}')
  from public.profiles p
  where p.id = any (ids)
    and exists (
      select 1 from public.follows f
      where f.user_id = auth.uid() and f.target = p.id::text and not f.deleted
    );
$$;

-- Find a passport by the code someone showed you (exact match only).
create or replace function public.find_passport(code text)
returns table (id uuid, name text, passport_no text, affinities text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.passport_no, p.affinities
  from public.profiles p
  where auth.uid() is not null
    and p.passport_no = upper(trim(code))
  limit 1;
$$;

revoke all on function public.passport_cards(uuid[]) from public, anon;
revoke all on function public.find_passport(text) from public, anon;
grant execute on function public.passport_cards(uuid[]) to authenticated;
grant execute on function public.find_passport(text) to authenticated;
