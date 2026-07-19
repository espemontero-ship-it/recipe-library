# Recipe Library v0.9.1.5 — cumulative from v0.9.1.3

Do **not** install v0.9.1.4 first. This package already includes the complete source-link fix plus source-image recovery.

## Included

- Preserves URLs when the copied text contains a plain link, Markdown link, or a hidden HTML hyperlink.
- Adds editable **Source URL** and **Cover image** fields to Paste Recipe.
- Saves them through the existing `originalUrl` and `image` recipe fields.
- Reads `og:image`, `twitter:image`, and Recipe JSON-LD from source pages.
- Stores source images in the public Supabase bucket `recipe-images` when `SUPABASE_SERVICE_ROLE_KEY` is configured; otherwise it keeps the external image URL.
- Recovers exact URLs already present in `raw_source_text` without guessing links from titles or “link in bio”.
- Includes an optional bulk image backfill for existing recipes.
- Creates a backup before changing `app/paste/page.tsx` and `package.json`.
- Safe to run more than once.

## Install over v0.9.1.3

1. Extract this folder into the **root of the Recipe Library project**, where `package.json` and the `app` folder are located.
2. On Windows, run `INSTALL.bat`.
   - Alternative: `node install.mjs .`
3. Open Supabase → SQL Editor and run:
   - `supabase/migrations/20260719_source_urls_and_images.sql`
4. Verify the application:
   - `npm run build`
   - `npm run dev`

## Recover images for existing recipes

URL recovery already happens in the SQL migration. Image recovery requires a server-side Supabase service key because the files are copied into your own Storage bucket.

Set these variables in the terminal used for the backfill:

```text
NEXT_PUBLIC_SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Preview without changing anything:

```bash
npm run backfill:sources -- --dry-run
```

Recover only URLs:

```bash
npm run backfill:sources -- --urls-only
```

Recover URLs and available images:

```bash
npm run backfill:sources
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser variables or commit it to GitHub.

## Expected limitations

- “Link in bio” does not contain the original URL and is left unresolved.
- Instagram, Facebook and TikTok sometimes block anonymous metadata access. Those rows are marked `image_needs_review = true` instead of receiving a guessed image.
- Normal recipe websites generally expose a usable source image through Open Graph, Twitter cards or Recipe JSON-LD.

## Rollback

The installer creates:

- `app/paste/page.tsx.backup-v0.9.1.3-before-source-images`
- `package.json.backup-v0.9.1.3-before-source-images`

Restore those files to undo the application patch. The SQL migration only adds fields, recovers exact URLs and creates a Storage bucket; it does not delete recipe content.
