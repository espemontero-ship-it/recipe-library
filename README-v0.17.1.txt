RECIPE LIBRARY v0.17.1 — GOOGLE SOURCE DISCOVERY

CHANGES
- Uses Google search first for missing recipe source links, with Bing and DuckDuckGo only as fallbacks.
- Searches by exact recipe title, creator or social handle, distinctive source phrases, ingredient fingerprints and likely social platform.
- Keeps Google results even when Instagram, Facebook or TikTok block direct metadata inspection.
- Uses multiple independent signals before saving a URL: title, creator, distinctive phrase and source-text overlap.
- Inspects accessible source pages for author, publication and main image.
- Copies accessible images into the existing recipe-images storage bucket.
- Leaves ambiguous results and book recipes unchanged.
- Keeps the hidden /maintenance route and all existing backup/restore protections.

INSTALL
1. Stop Recipe Library.
2. Run INSTALL.bat.
3. Start or redeploy the app.
4. Sign in as administrator.
5. Open your domain followed by /maintenance.
6. Click “Recover sources” again.

The previous two recovered links remain unchanged. No SQL is required.
