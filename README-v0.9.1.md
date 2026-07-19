# Recipe Library v0.9.1 — Save new recipes to Supabase

This patch connects the existing `/paste` importer to `public.recipes_clean_v14_final`.

## Included

- Administrator-only recipe creation through existing Supabase RLS.
- Duplicate-title detection using the canonical recipe slug.
- Storage of title, author, publication, servings, time display, ingredients, method, classifications and original pasted text.
- Serving suggestion stored in structured recipe notes.
- Automatic navigation to the newly created public recipe.
- Source nutrition preserved in `qa.source_nutrition`; canonical macro columns remain empty until the later macro-calculation phase.
- New recipes are marked `complete` when ingredients and method are present, otherwise `partial_from_source`.

## Install

Copy the contents of this package over the project root, then run:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npm run build
```

No new Supabase SQL is required. Existing v0.9.0 administrator write policies are used.
