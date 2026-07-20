RECIPE LIBRARY v0.12.2 — COMPACT SOCIAL PASTE FIX

This patch fixes social recipes copied from Facebook, Instagram or TikTok as one continuous line without line breaks.

Changes:
- Reconstructs the copy into URL, author, social audio attribution, title, ingredient section, ingredient rows and numbered method steps before parsing.
- Keeps the profile name as author instead of title.
- Detects ingredient subsections such as Dipping Sauce and To Serve.
- Detects numbered method steps even when the whole caption is a single line.
- Preserves the automatic nutrition parser removal; macros remain manual per serving.
- Does not bulk-modify existing database recipes.

Verified with the exact reported Facebook Reel paste:
- Author: Coconut and Bliss
- Title: Crispy red curry chicken bites - they’re basically little rice paper dumplings, cooked in the air fryer until crispy
- 20 ingredient rows
- 7 method steps

Regression suite:
- 28 complete recipe fixtures pass.
- 33 ingredient-line fixtures pass.
- 61/61 total pass.

Installation:
1. Stop the app with Ctrl+C.
2. Extract this folder next to the project package.json.
3. Run INSTALL.bat.
4. Run npm run dev.

No SQL is required.
