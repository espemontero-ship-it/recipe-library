# Recipe Library v0.3.5 — Save and Open Recipe

## Behaviour

- There is no Draft status.
- The primary action is **Save recipe**.
- Missing optional fields do not block saving.
- Required:
  - title;
  - at least one ingredient or one method step.
- Saving creates a local recipe record.
- The app immediately opens the new recipe page.
- Saved recipes appear in Browse.
- Data persists in this browser through localStorage.

## Files

- `lib/browserRecipeStorage.ts`
- `app/paste/page.tsx`
- `app/recipes/[id]/page.tsx`
- `app/recipes/[id]/recipe.module.css`
- `app/browse/page.tsx`
- `app/browse/browse.module.css`

## Test

1. Run:

```powershell
npm run dev
```

2. Open:

```text
http://localhost:3000/paste
```

3. Load the salmon example.
4. Extract it.
5. Delete an optional value such as publication.
6. Click **Save recipe**.
7. Confirm the recipe page opens.
8. Open `/browse` and confirm the recipe appears.

## Build

```powershell
npm run build
```

## Commit

```powershell
git add app lib
git commit -m "feat: save imported recipes and open recipe page"
git push origin main
```
