RECIPE LIBRARY v0.12.1 — SOCIAL COPY PARSER FIX

This patch fixes the exact Facebook Reel copy format reported after Parser v2.

Changes:
- When copied Facebook, Instagram or TikTok text contains Follow/Seguir chrome, the profile name is stored as author instead of title.
- Social separators and audio attribution are ignored when selecting the recipe title.
- Numbered preparation steps are detected even when there is no Method, Preparation or Instructions heading.
- "To Serve" remains an ingredient subsection when it appears before the numbered method.
- The exact Coconut and Bliss Facebook Reel example is now a permanent regression fixture.

Verified result for that example:
- Author: Coconut and Bliss
- Title: Crispy red curry chicken bites - they’re basically little rice paper dumplings, cooked in the air fryer until crispy
- 20 ingredient rows, including Dipping Sauce and To Serve subsections
- 7 method steps

Regression suite:
- 27 complete recipe fixtures pass.
- 33 ingredient-line fixtures pass.
- 60/60 total pass.

Scope:
- Used for newly pasted recipes.
- Does not bulk-rewrite existing database recipes.
- Does not restore the automatic nutrition parser; macros remain manual per serving.

Installation:
1. Stop the app with Ctrl+C.
2. Place the extracted folder next to the project package.json.
3. Run INSTALL.bat.
4. Run npm run dev.

No SQL is required.
