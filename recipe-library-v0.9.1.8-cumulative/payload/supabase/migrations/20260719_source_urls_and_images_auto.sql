-- Recipe Library v0.9.1.7
-- Cumulative migration from v0.9.1.3+.
-- Detects the active recipe table instead of assuming its name.
-- It only recovers URLs that already exist verbatim in raw_source_text.

begin;

create temporary table if not exists recipe_library_migration_target (
  table_schema text not null,
  table_name text not null
);
truncate recipe_library_migration_target;

create temporary table if not exists recipe_library_migration_result (
  active_table text not null,
  total_recipes bigint not null,
  recipes_with_source_url bigint not null,
  urls_recovered_from_raw_text bigint not null,
  recipes_with_image bigint not null,
  images_needing_review bigint not null
);
truncate recipe_library_migration_result;

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

do $$
declare
  target_schema text := 'public';
  target_table text;
  candidate text;
  qualified_table text;
  index_name text;
begin
  -- Prefer the table already referenced by the app's private-state foreign key.
  if to_regclass('public.recipe_private_state') is not null then
    select target.relname
      into target_table
    from pg_constraint constraint_row
    join pg_class target on target.oid = constraint_row.confrelid
    join pg_namespace target_namespace on target_namespace.oid = target.relnamespace
    where constraint_row.contype = 'f'
      and constraint_row.conrelid = to_regclass('public.recipe_private_state')
      and target_namespace.nspname = 'public'
      and exists (
        select 1
        from unnest(constraint_row.conkey) as source_key(attnum)
        join pg_attribute source_attribute
          on source_attribute.attrelid = constraint_row.conrelid
         and source_attribute.attnum = source_key.attnum
        where source_attribute.attname = 'recipe_id'
      )
    order by constraint_row.oid
    limit 1;
  end if;

  -- Then try the known Recipe Library table names, newest first.
  if target_table is null then
    foreach candidate in array array[
      'recipes_clean_v14_final',
      'recipes_clean_v14',
      'recipes'
    ]
    loop
      if to_regclass(format('%I.%I', target_schema, candidate)) is not null then
        target_table := candidate;
        exit;
      end if;
    end loop;
  end if;

  -- Last resort: find the most recipe-like base table in public.
  if target_table is null then
    select table_row.table_name
      into target_table
    from information_schema.tables table_row
    where table_row.table_schema = 'public'
      and table_row.table_type = 'BASE TABLE'
      and exists (
        select 1 from information_schema.columns column_row
        where column_row.table_schema = table_row.table_schema
          and column_row.table_name = table_row.table_name
          and column_row.column_name = 'id'
      )
      and exists (
        select 1 from information_schema.columns column_row
        where column_row.table_schema = table_row.table_schema
          and column_row.table_name = table_row.table_name
          and column_row.column_name = 'title'
      )
      and exists (
        select 1 from information_schema.columns column_row
        where column_row.table_schema = table_row.table_schema
          and column_row.table_name = table_row.table_name
          and column_row.column_name = 'slug'
      )
    order by
      (
        select count(*)
        from information_schema.columns column_row
        where column_row.table_schema = table_row.table_schema
          and column_row.table_name = table_row.table_name
          and column_row.column_name in (
            'raw_source_text', 'source_url', 'cover_image',
            'ingredients_raw', 'method', 'servings_display'
          )
      ) desc,
      table_row.table_name
    limit 1;
  end if;

  if target_table is null then
    raise exception 'Recipe Library could not find an active recipe table in schema public.'
      using hint = 'Check that this SQL Editor is connected to the same Supabase project as the application.';
  end if;

  qualified_table := format('%I.%I', target_schema, target_table);
  index_name := left(target_table || '_source_url_idx', 63);

  insert into recipe_library_migration_target(table_schema, table_name)
  values (target_schema, target_table);

  execute format(
    'alter table %s
       add column if not exists source_url text,
       add column if not exists raw_source_text text,
       add column if not exists cover_image text,
       add column if not exists source_url_confidence text,
       add column if not exists image_source text,
       add column if not exists image_needs_review boolean not null default false',
    qualified_table
  );

  -- Preserve the legacy image_url field when present.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = target_schema
      and table_name = target_table
      and column_name = 'image_url'
  ) then
    execute format(
      'update %s
          set cover_image = image_url
        where nullif(btrim(cover_image), '''') is null
          and nullif(btrim(image_url), '''') is not null',
      qualified_table
    );
  end if;

  execute format(
    'update %s
        set source_url_confidence = coalesce(source_url_confidence, ''existing'')
      where nullif(btrim(source_url), '''') is not null',
    qualified_table
  );

  execute format($migration$
    with candidates as (
      select
        id,
        (regexp_match(
          raw_source_text,
          $url$(https?://[^\s<>"')\]}]+)$url$,
          'i'
        ))[1] as recovered_url
      from %s
      where nullif(btrim(source_url), '') is null
        and raw_source_text ~* $url$https?://$url$
    ), cleaned as (
      select
        id,
        regexp_replace(recovered_url, '[.,;:!?]+$', '') as recovered_url
      from candidates
      where recovered_url is not null
    )
    update %s as recipe
       set source_url = cleaned.recovered_url,
           source_url_confidence = 'exact_raw_text'
      from cleaned
     where recipe.id = cleaned.id
       and nullif(btrim(recipe.source_url), '') is null
  $migration$, qualified_table, qualified_table);

  execute format(
    'create index if not exists %I on %s (source_url) where source_url is not null',
    index_name,
    qualified_table
  );

  execute format('drop trigger if exists recipe_library_source_provenance on %s', qualified_table);
  execute format(
    'create trigger recipe_library_source_provenance
       before insert or update of source_url, cover_image
       on %s
       for each row
       execute function public.recipe_library_set_source_provenance()',
    qualified_table
  );

  -- Expose the selected name to the optional local backfill script.
  execute format($function$
    create or replace function public.recipe_library_active_table()
    returns text
    language sql
    stable
    as $body$ select %L::text $body$
  $function$, target_table);

  execute format(
    'insert into recipe_library_migration_result (
       active_table,
       total_recipes,
       recipes_with_source_url,
       urls_recovered_from_raw_text,
       recipes_with_image,
       images_needing_review
     )
     select
       %L,
       count(*),
       count(*) filter (where nullif(btrim(source_url), '''') is not null),
       count(*) filter (where source_url_confidence = ''exact_raw_text''),
       count(*) filter (where nullif(btrim(cover_image), '''') is not null),
       count(*) filter (where image_needs_review)
     from %s',
    target_schema || '.' || target_table,
    qualified_table
  );
end
$$;

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

select * from recipe_library_migration_result;
