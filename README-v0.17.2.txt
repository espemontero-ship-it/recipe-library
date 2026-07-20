RECIPE LIBRARY v0.17.2 — RESEARCHED SOURCE LINK BATCH

CHANGES
- Removes the failed browser-based Google/Bing/DuckDuckGo source discovery workflow.
- Bundles 90 source links researched outside the application: 83 exact web matches and 7 exact duplicate-recipe matches.
- Applies only the bundled links; it performs no web searches and therefore completes quickly.
- Downloads a complete source backup before writing.
- Preserves any different source URL already present in the live recipe.
- Skips recipes changed during application instead of overwriting them.
- Downloads an application log after completion.
- Removes the three temporary source discovery API routes and the unused server scraper.
- Does not attempt image uploads. Supabase Storage rejected the previous uploads under the current RLS policy, so images remain a separate task.

INSTALL
1. Stop Recipe Library.
2. Run INSTALL.bat.
3. Start or redeploy the app.
4. Sign in as administrator.
5. Open your domain followed by /maintenance.
6. Click “Apply 90 links”.

No SQL is required.
