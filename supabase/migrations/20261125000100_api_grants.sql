-- Explicit Data API grants.
-- New Supabase projects can be created with "Grant API access to new tables automatically"
-- turned off, and then the app can't reach any table. These grants make the schema work
-- either way, with only what the app uses. Row Level Security (on for every table) still
-- decides which rows each person can see or change.

grant usage on schema public to anon, authenticated, service_role;

-- The seeded catalog is public.
grant select on public.items to anon, authenticated;

-- A signed-in passport holder reads and upserts their own rows (and followers' rows where
-- a policy allows it). Upserts need select, insert and update.
grant select, insert, update on
  public.profiles,
  public.custom_items,
  public.stamps,
  public.canon,
  public.wishlist,
  public.follows,
  public.likes,
  public.dispatches,
  public.presence
to authenticated;

-- An un-stamped work removes its dispatch.
grant delete on public.dispatches to authenticated;

-- Server-side tooling (the dashboard, scripts) keeps full access; it bypasses RLS anyway.
grant all on all tables in schema public to service_role;
