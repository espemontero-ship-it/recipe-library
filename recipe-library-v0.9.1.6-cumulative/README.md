# Recipe Library v0.9.1.6 — cumulative source URL and image fix

Cumulative from installed v0.9.1.3. It may also be run over v0.9.1.5.

## Included

- Preserves visible and hidden URLs when a recipe is pasted.
- Saves the source URL with the recipe.
- Reads a public source image when the page exposes one.
- Stores retrievable source images in the public `recipe-images` Supabase bucket.
- Recovers exact URLs already present in `raw_source_text`.
- Uses the live application table, `public.recipes`.

## Installation

1. Extract this folder into the Recipe Library project root.
2. Run `INSTALL.bat` on Windows or `INSTALL.command` on macOS.
3. In Supabase SQL Editor, run:
   `supabase/migrations/20260719_source_urls_and_images_v2.sql`
4. Run `npm run build`.

## Optional recovery

After setting `SUPABASE_SERVICE_ROLE_KEY` locally:

- Preview: `npm run backfill:sources -- --dry-run`
- Recover URLs only: `npm run backfill:sources -- --urls-only`
- Recover URLs and images: `npm run backfill:sources`

The backfill now targets `public.recipes` by default.
