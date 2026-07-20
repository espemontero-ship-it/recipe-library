begin;

alter table public.recipes_clean_v14_final
  add column if not exists source_medium text,
  add column if not exists source_publication text,
  add column if not exists prep_time_minutes integer,
  add column if not exists cook_time_minutes integer,
  add column if not exists resting_time_minutes integer,
  add column if not exists marinating_time_minutes integer,
  add column if not exists tags text[] not null default '{}';

update public.recipes_clean_v14_final
set source_publication = coalesce(source_publication, source_type)
where source_publication is null;

update public.recipes_clean_v14_final
set source_medium = coalesce(
  source_medium,
  case
    when source_url ilike '%instagram.com%' then 'instagram'
    when source_url ilike '%tiktok.com%' then 'tiktok'
    when source_url ilike '%facebook.com%' then 'facebook'
    when source_url is not null then 'web'
    else null
  end
)
where source_medium is null;

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "recipe_images_insert_own" on storage.objects;
create policy "recipe_images_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "recipe_images_update_own" on storage.objects;
create policy "recipe_images_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "recipe_images_delete_own" on storage.objects;
create policy "recipe_images_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
