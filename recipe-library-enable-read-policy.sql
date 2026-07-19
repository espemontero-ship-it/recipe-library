-- Allow the public Recipe Library app to read recipes.
-- This only enables SELECT; it does not allow anonymous edits or deletions.

create policy "Public recipes are readable"
on public.recipes
for select
to anon
using (true);
