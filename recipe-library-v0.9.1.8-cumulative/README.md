# Recipe Library v0.9.1.8 — cumulative importer repair

Cumulative from installed v0.9.1.3. It can be installed directly over v0.9.1.5, v0.9.1.6 or v0.9.1.7.

## Included

- Repairs the missing Source URL field in the review form.
- Preserves visible and hidden URLs when a recipe is pasted.
- Saves the source URL with the recipe.
- Shows the Cover image URL and an actual image preview when one is found.
- Adds a Find source image button.
- Splits NYT-style `Step 1`, `Step 2`, etc. into separate recipe steps.
- Also splits ordinary `1.`, `2.`, `3.` and keycap-number instructions.
- Keeps the automatic source-image endpoint and old-recipe backfill tools.
- Rechecks every required patch even when an older patch marker already exists.

## Installation

1. Extract/copy this package into the Recipe Library project root.
2. Run `INSTALL.bat` on Windows or `INSTALL.command` on macOS.
3. Restart the local app with `npm run dev`.
4. Open `http://localhost:3000/paste`.

## Supabase

Do not run another SQL migration if `20260719_source_urls_and_images_auto.sql` already completed and returned an `active_table`, as it did for `public.recipes_clean_v14_final`.

For a completely fresh installation from v0.9.1.3 only, the automatic migration remains available at:
`supabase/migrations/20260719_source_urls_and_images_auto.sql`

## Optional old-image recovery

After setting `SUPABASE_SERVICE_ROLE_KEY` locally:

- Preview: `npm run backfill:sources -- --dry-run`
- Recover URLs only: `npm run backfill:sources -- --urls-only`
- Recover URLs and images: `npm run backfill:sources`
