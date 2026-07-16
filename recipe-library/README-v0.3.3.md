# Recipe Library v0.3.3 — Editorial Recipe Page

## Files

- `app/recipes/[id]/page.tsx`
- `app/recipes/[id]/recipe.module.css`

Copy the `app` folder into the repository root and allow Windows to replace
`app/recipes/[id]/page.tsx`.

## Review

Start the server:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000/recipes/black-pepper-beef-cabbage
```

Second sample:

```text
http://localhost:3000/recipes/salmon-lemon-herb-marinade
```

## Build check

```powershell
npm run build
```

## Commit after approval

```powershell
git add app/recipes/[id]/page.tsx app/recipes/[id]/recipe.module.css
git commit -m "feat: add editorial recipe detail page"
git push origin main
```
