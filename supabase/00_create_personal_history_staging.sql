-- Recipe Library v0.8.1 · Step 1
-- Creates a protected staging table. It does not modify recipes.

drop table if exists public.recipe_personal_history_v081_staging;

create table public.recipe_personal_history_v081_staging (
  slug text primary key,
  tested boolean not null default false,
  this_weekend boolean not null default false,
  rating integer null check (rating between 1 and 5),
  source_section text null,
  source_rating text null
);

alter table public.recipe_personal_history_v081_staging
enable row level security;

revoke all
on table public.recipe_personal_history_v081_staging
from anon, authenticated;
