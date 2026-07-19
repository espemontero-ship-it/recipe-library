# Recipe Library v0.9.1.7 — cumulative URL and source-image fix

Cumulative from installed v0.9.1.3. It can be installed directly over v0.9.1.5 or v0.9.1.6.

## Included

- Preserves visible and hidden URLs when a recipe is pasted.
- Saves the source URL with the recipe.
- Reads a public source image when the source page exposes one.
- Stores retrievable source images in the public `recipe-images` Supabase bucket.
- Recovers exact URLs already present in `raw_source_text`.
- Detects the active Supabase recipe table automatically. It supports `recipes_clean_v14_final`, `recipes_clean_v14`, `recipes`, and compatible renamed tables.

## Installation

1. Extract this folder into the Recipe Library project root.
2. Run `INSTALL.bat` on Windows or `INSTALL.command` on macOS.
3. In Supabase SQL Editor, run:
   `supabase/migrations/20260719_source_urls_and_images_auto.sql`
4. The result must show the detected table in `active_table`.
5. Run `npm run build`.

## Optional recovery

After setting `SUPABASE_SERVICE_ROLE_KEY` locally:

- Preview: `npm run backfill:sources -- --dry-run`
- Recover URLs only: `npm run backfill:sources -- --urls-only`
- Recover URLs and images: `npm run backfill:sources`

The backfill reads the table selected by the automatic migration. `RECIPE_TABLE` remains available as a manual override.
