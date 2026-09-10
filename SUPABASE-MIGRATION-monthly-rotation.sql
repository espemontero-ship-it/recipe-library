begin;

alter table public.recipes_clean_v14_final
  add column if not exists monthly_rotation boolean not null default false;

commit;
