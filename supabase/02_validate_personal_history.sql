-- Recipe Library v0.8.1 · Step 4

select
  count(*) as total,
  count(*) filter (where tested) as tested,
  count(*) filter (where this_weekend) as this_weekend,
  count(*) filter (where rating is not null) as rated,
  count(*) filter (where rating = 5) as five_stars,
  count(*) filter (where rating = 4) as four_stars,
  count(*) filter (where rating = 3) as three_stars
from public.recipes_clean_v14_final;
