-- Recipe Library v0.8.1 · Step 3
-- Updates only tested, this_weekend and rating.

begin;

update public.recipes_clean_v14_final as r
set
  tested = s.tested,
  this_weekend = s.this_weekend,
  rating = s.rating,
  updated_at = now()
from public.recipe_personal_history_v081_staging as s
where r.slug = s.slug;

commit;

select count(*) as matched_rows
from public.recipes_clean_v14_final r
join public.recipe_personal_history_v081_staging s using (slug);
