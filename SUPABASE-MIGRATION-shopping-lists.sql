-- Kitchen Index: standalone shopping lists ("Lists" section).
-- Independent from Planning/Shopping: nothing here changes when Planning does.
-- Safe to run more than once.

begin;

create extension if not exists pgcrypto;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_lists_user_idx
  on public.shopping_lists (user_id, created_at desc);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (length(btrim(text)) > 0),
  checked boolean not null default false,
  recipe_titles text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_list_items_list_idx
  on public.shopping_list_items (list_id, position, created_at);

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row execute function public.recipe_library_set_updated_at();

drop trigger if exists shopping_list_items_set_updated_at on public.shopping_list_items;
create trigger shopping_list_items_set_updated_at
before update on public.shopping_list_items
for each row execute function public.recipe_library_set_updated_at();

alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

drop policy if exists "Users read own shopping lists" on public.shopping_lists;
create policy "Users read own shopping lists"
on public.shopping_lists for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own shopping lists" on public.shopping_lists;
create policy "Users insert own shopping lists"
on public.shopping_lists for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own shopping lists" on public.shopping_lists;
create policy "Users update own shopping lists"
on public.shopping_lists for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own shopping lists" on public.shopping_lists;
create policy "Users delete own shopping lists"
on public.shopping_lists for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users read own shopping list items" on public.shopping_list_items;
create policy "Users read own shopping list items"
on public.shopping_list_items for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own shopping list items" on public.shopping_list_items;
create policy "Users insert own shopping list items"
on public.shopping_list_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own shopping list items" on public.shopping_list_items;
create policy "Users update own shopping list items"
on public.shopping_list_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own shopping list items" on public.shopping_list_items;
create policy "Users delete own shopping list items"
on public.shopping_list_items for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.shopping_list_items to authenticated;

commit;
