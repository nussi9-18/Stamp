-- Indie shorts: short films by new and independent filmmakers.
--
-- Anyone with an account can send a YouTube or Vimeo link to a short they made (or have the
-- right to share). It waits as 'pending' until you approve it in the Supabase dashboard:
-- Table Editor → shorts → set status to 'live' (and reviewed_at to now()). Live shorts are
-- public; everything else is visible only to the person who sent it.
-- Applause reuses public.likes with dispatch_id 'short:<uuid>'.

create table public.shorts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  filmmaker text not null check (char_length(btrim(filmmaker)) between 1 and 60),
  -- canonical links only (the app normalises whatever was pasted)
  url text not null check (
    url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'
    or url ~ '^https://vimeo\.com/[0-9]{5,12}(/[0-9a-f]{6,20})?$'
  ),
  mins smallint not null check (mins between 1 and 40),
  year smallint check (year between 1950 and 2100),
  cc text check (cc ~ '^[A-Z]{2}$'),
  genre text not null check (genre in ('drama', 'comedy', 'horror', 'animation', 'documentary', 'experimental', 'sci-fi', 'romance')),
  logline text not null check (char_length(btrim(logline)) between 1 and 160),
  -- heat vectors as the filmmaker declared them (8 × 0–3), for the comfort shield
  v smallint[] check (v is null or (cardinality(v) = 8 and 0 <= all (v) and 3 >= all (v))),
  maker_link text check (maker_link is null or (maker_link ~ '^https://' and char_length(maker_link) <= 300)),
  status text not null default 'pending' check (status in ('pending', 'live', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- One entry per film (a rejected one can be sent again).
create unique index shorts_url_key on public.shorts (url) where status <> 'rejected';
create index shorts_live_idx on public.shorts (created_at desc) where status = 'live';
create index shorts_user_idx on public.shorts (user_id, created_at desc);

-- At most five films waiting for review per person.
create or replace function public.shorts_quota()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.shorts where user_id = new.user_id and status = 'pending') >= 5 then
    raise exception 'too many shorts waiting for review' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger shorts_quota before insert on public.shorts
  for each row execute function public.shorts_quota();

alter table public.shorts enable row level security;

create policy "live shorts are public" on public.shorts
  for select to anon, authenticated
  using (status = 'live');

create policy "see your own shorts" on public.shorts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Sending: always as yourself, always pending. Approval happens in the dashboard.
create policy "send a short" on public.shorts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_at is null);

create policy "withdraw your short" on public.shorts
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- No update policy: a sent film can be withdrawn and sent again, not edited.

/* ── Reports ───────────────────────────────────────────────────────────── */

create table public.short_reports (
  id uuid primary key default gen_random_uuid(),
  short_id uuid not null references public.shorts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('not-theirs', 'harmful', 'broken', 'spam')),
  created_at timestamptz not null default now(),
  unique (short_id, user_id)
);

alter table public.short_reports enable row level security;

-- Write-only for people; you read reports in the dashboard.
create policy "report a short" on public.short_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shorts s where s.id = short_id and s.status = 'live')
  );

/* ── Applause ──────────────────────────────────────────────────────────── */

-- How many other people applauded each live short (your own applause is counted on the device).
create or replace function public.short_applause(ids uuid[])
returns table (short_id uuid, others bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
         count(l.user_id) filter (where l.user_id is distinct from auth.uid())
  from public.shorts s
  left join public.likes l
    on l.dispatch_id = 'short:' || s.id::text and not l.deleted
  where s.id = any (ids)
    and s.status = 'live'
  group by s.id;
$$;

revoke all on function public.short_applause(uuid[]) from public;
grant execute on function public.short_applause(uuid[]) to anon, authenticated;

/* ── Data API grants (see 20261125000100_api_grants.sql) ───────────────── */

grant select on public.shorts to anon;
grant select, insert, delete on public.shorts to authenticated;
grant insert on public.short_reports to authenticated;
grant all on public.shorts, public.short_reports to service_role;
