RECIPE LIBRARY v0.17.0 — SOURCE RECOVERY AND CLEANUP

CHANGES
- Removes Recipe Audit, Recipe Repair and Repair Batch from navigation and deletes their routes.
- Adds a hidden administrator-only maintenance route: /maintenance
- Keeps repair backup restoration and the technical repair record in maintenance.
- Recovers original source URLs from exact links already present in pasted recipe text.
- Searches the public web for missing sources and saves only high-confidence matches.
- Inspects confirmed source pages for title, author, publication and cover image metadata.
- Copies accessible source images into the existing Recipe Library recipe-images storage bucket.
- Leaves book recipes, ambiguous matches, blocked pages and inaccessible images unchanged.
- Downloads a source-field backup before the first update.
- Skips recipes changed during recovery rather than overwriting them.

INSTALL
1. Stop Recipe Library.
2. Run INSTALL.bat.
3. Start the app with: npm run dev
4. Sign in as administrator.
5. Open: http://localhost:3000/maintenance
6. Click “Recover sources”.

PRODUCTION
Use your normal production URL followed by /maintenance.
The maintenance route is not shown in the application menu.

BACKUPS
- A complete source-field backup downloads before recovery.
- The source backup and the previous recipe-repair backup can both be restored from /maintenance.
- The last source-recovery log is stored locally in the browser and downloaded after each run.

No SQL is required.
