# Recipe Library v0.4.0 — Canonical Recipe Model

## Included

- Versioned canonical `Recipe` domain model.
- Separate source, yield, content, nutrition, classification, personal and media data.
- Multiple ingredient and method sections.
- Nutrition values stored as numbers rather than presentation strings.
- Status and visibility types.
- Validation with required fields and non-blocking warnings.
- Versioned localStorage envelope.
- Automatic migration of recipes saved by v0.3.5.
- Importer, Browse and Recipe Detail updated to use the canonical model.
- Raw pasted text preserved on imported recipes.
- JSON export helper prepared for backups and Supabase migration.

## Install

Copy the `app` and `lib` folders into the repository root and replace the
existing files.

## Test

```powershell
npm run dev
```

1. Open `/browse`; existing v0.3.5 recipes should migrate automatically.
2. Open an existing recipe.
3. Import and save a new recipe.
4. Confirm both appear in Browse.

## Build

```powershell
npm run build
```

## Commit

```powershell
git add app lib
git commit -m "refactor: introduce canonical recipe domain model"
git push origin main
```
