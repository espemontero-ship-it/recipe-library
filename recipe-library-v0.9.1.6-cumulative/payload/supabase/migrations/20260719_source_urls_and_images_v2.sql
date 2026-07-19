-- Recipe Library v0.9.1.6
-- Safe cumulative migration from installed v0.9.1.3 / v0.9.1.5.
-- Targets the live application table: public.recipes.
-- Recovers only exact URLs present in raw_source_text; it never guesses links.

begin;

alter table public.recipes
  add column if not exists source_url text,
  add column if not exists raw_source_text text,
  add column if not exists cover_image text,
  add column if not exists source_url_confidence text,
  add column if not exists image_source text,
  add column if not exists image_needs_review boolean not null default false;

-- Preserve an older image_url value when cover_image has not been populated yet.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recipes'
      and column_name = 'image_url'
  ) then
    execute $copy$
      update public.recipes
      set cover_image = image_url
      where nullif(btrim(cover_image), '') is null
        and nullif(btrim(image_url), '') is not null
    $copy$;
  end if;
end
$$;

update public.recipes
set source_url_confidence = coalesce(source_url_confidence, 'existing')
where nullif(btrim(source_url), '') is not null;

with candidates as (
  select
    id,
    (regexp_match(
      raw_source_text,
      $url$(https?://[^\s<>"')\]}]+)$url$,
      'i'
    ))[1] as recovered_url
  from public.recipes
  where nullif(btrim(source_url), '') is null
    and raw_source_text ~* $url$https?://$url$
), cleaned as (
  select
    id,
    regexp_replace(recovered_url, '[.,;:!?]+$', '') as recovered_url
  from candidates
  where recovered_url is not null
)
update public.recipes as recipe
set
  source_url = cleaned.recovered_url,
  source_url_confidence = 'exact_raw_text'
from cleaned
where recipe.id = cleaned.id
  and nullif(btrim(recipe.source_url), '') is null;

create index if not exists recipes_source_url_idx
  on public.recipes (source_url)
  where source_url is not null;

create or replace function public.recipe_library_set_source_provenance()
returns trigger
language plpgsql
as $$
begin
  if nullif(btrim(new.source_url), '') is null then
    new.source_url_confidence := null;
  elsif new.source_url_confidence is null then
    new.source_url_confidence := 'imported';
  end if;

  if nullif(btrim(new.cover_image), '') is null then
    new.image_source := null;
  elsif new.image_source is null then
    new.image_source := 'importer';
  end if;

  return new;
end;
$$;

drop trigger if exists recipe_library_source_provenance
  on public.recipes;

create trigger recipe_library_source_provenance
before insert or update of source_url, cover_image
on public.recipes
for each row
execute function public.recipe_library_set_source_provenance();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'recipe-images',
  'recipe-images',
  true,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

select
  count(*) as total_recipes,
  count(*) filter (where nullif(btrim(source_url), '') is not null) as recipes_with_source_url,
  count(*) filter (where source_url_confidence = 'exact_raw_text') as urls_recovered_from_raw_text,
  count(*) filter (where nullif(btrim(cover_image), '') is not null) as recipes_with_image,
  count(*) filter (where image_needs_review) as images_needing_review
from public.recipes;
