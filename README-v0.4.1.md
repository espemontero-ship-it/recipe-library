# Recipe Library v0.4.1 — Global Navigation

This patch adds a real shared navigation menu to every screen.

## Included

- Home
- Browse
- Collections
- Paste recipe
- Search shortcut
- Active-page state
- Responsive mobile menu

## Files

- `app/layout.tsx`
- `app/globals.css`
- `components/AppHeader.tsx`

Copy the `app` and `components` folders into the repository root and replace
the existing files.

## Test

```powershell
npm run dev
```

Check that the same menu appears and works on:

- `/`
- `/browse`
- `/collections`
- `/paste`
- `/recipes/<id>`

## Build

```powershell
npm run build
```

## Commit

```powershell
git add app/layout.tsx app/globals.css components/AppHeader.tsx
git commit -m "fix: add working global navigation"
git push origin main
```
