-- Recipe Library v0.10.17
-- Planning and shopping list stored per authenticated user in Supabase.

begin;

create extension if not exists pgcrypto;

create table if not exists public.recipe_planning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  week_start date not null,
  servings numeric(8,2) not null default 1 check (servings > 0),
  include_in_shopping boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_planning_items_user_recipe_week_key
    unique (user_id, recipe_id, week_start)
);

create index if not exists recipe_planning_items_user_week_idx
  on public.recipe_planning_items (user_id, week_start);

create table if not exists public.recipe_shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  text text not null check (length(btrim(text)) > 0),
  checked boolean not null default false,
  manual boolean not null default false,
  sources jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_shopping_items_user_week_position_idx
  on public.recipe_shopping_items (user_id, week_start, position, created_at);

create or replace function public.recipe_library_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recipe_planning_items_set_updated_at
  on public.recipe_planning_items;
create trigger recipe_planning_items_set_updated_at
before update on public.recipe_planning_items
for each row execute function public.recipe_library_set_updated_at();

drop trigger if exists recipe_shopping_items_set_updated_at
  on public.recipe_shopping_items;
create trigger recipe_shopping_items_set_updated_at
before update on public.recipe_shopping_items
for each row execute function public.recipe_library_set_updated_at();

alter table public.recipe_planning_items enable row level security;
alter table public.recipe_shopping_items enable row level security;

drop policy if exists "Users read own recipe planning" on public.recipe_planning_items;
create policy "Users read own recipe planning"
on public.recipe_planning_items for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own recipe planning" on public.recipe_planning_items;
create policy "Users insert own recipe planning"
on public.recipe_planning_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own recipe planning" on public.recipe_planning_items;
create policy "Users update own recipe planning"
on public.recipe_planning_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own recipe planning" on public.recipe_planning_items;
create policy "Users delete own recipe planning"
on public.recipe_planning_items for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users read own shopping items" on public.recipe_shopping_items;
create policy "Users read own shopping items"
on public.recipe_shopping_items for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own shopping items" on public.recipe_shopping_items;
create policy "Users insert own shopping items"
on public.recipe_shopping_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own shopping items" on public.recipe_shopping_items;
create policy "Users update own shopping items"
on public.recipe_shopping_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own shopping items" on public.recipe_shopping_items;
create policy "Users delete own shopping items"
on public.recipe_shopping_items for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.recipe_planning_items to authenticated;
grant select, insert, update, delete on public.recipe_shopping_items to authenticated;

-- Add both tables to Supabase Realtime when the publication is available.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.recipe_planning_items;
    exception when duplicate_object then
      null;
    end;
    begin
      alter publication supabase_realtime add table public.recipe_shopping_items;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;

commit;

select
  to_regclass('public.recipe_planning_items') as planning_table,
  to_regclass('public.recipe_shopping_items') as shopping_table;
