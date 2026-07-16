# Recipe Library v0.3.4 — Paste Recipe Importer MVP

## Included

- Markdown-aware recipe parser
- Title, author and publication extraction
- Servings and time extraction
- Ingredient extraction
- Structured method steps
- Nutrition exact values and ranges
- Main ingredient and method suggestions
- Review states: Confirmed, Review and Missing
- Editable review form
- Browser draft persistence
- Salmon acceptance-test example

## Install

Copy the `app` folder into the repository root and replace the existing
`app/paste/page.tsx`.

The delivery also adds:

```text
app/paste/paste.module.css
```

## Review

```powershell
npm run dev
```

Open:

```text
http://localhost:3000/paste
```

Click **Load salmon example**, then **Extract recipe**.

## Build check

```powershell
npm run build
```

## Commit after approval

```powershell
git add app/paste/page.tsx app/paste/paste.module.css
git commit -m "feat: add paste recipe importer MVP"
git push origin main
```

## Known limitation

This MVP stores the saved draft in the current browser. Database persistence
will be added with Supabase.
