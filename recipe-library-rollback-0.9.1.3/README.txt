RECIPE LIBRARY — SAFE ROLLBACK

1. Copy this entire folder into the Recipe Library project root.
   That is the folder containing package.json and the app folder.
2. Double-click ROLLBACK.bat.
3. Run npm run dev again.
4. Open http://localhost:3000/paste

The script restores the importer and package.json backups created before the failed URL/image patches.
It does not undo the successful Supabase migration, because the added nullable columns are harmless.

It also creates recipe-library-diagnostic.zip in the project root. That ZIP contains source code only and excludes .env files and secrets.
