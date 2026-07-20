# Recipe Library changelog

## v0.16.0 — Password sign-in and recovery

- Replaces Google and magic-link access with email-and-password sign-in.
- Adds a standard forgotten-password flow.
- Sends a recovery link that opens a dedicated new-password page instead of signing the user into the library.
- Adds password confirmation, expiry handling, and a clean return to the login page after the password is changed.
- Keeps administrator authorization unchanged.

## v0.15.0 — Complete repair batch

- Bundles the completed repair plan generated from the 542-recipe audit.
- Repairs 237 recipes in one conflict-protected batch.
- Leaves 305 recipes untouched because they were already correct or required no change.
- Downloads a database backup before the first write.
- Skips any recipe whose live snapshot differs from the audited snapshot.
- Adds rollback from the downloaded backup.
- Requires no SQL and no recipe-by-recipe validation.

# Recipe Library v0.14.2

- Adds import support for repair-plan JSON files in `/recipe-repair`.
- Imported Ready suggestions return to Unreviewed so the administrator only validates and approves them.
- Matches imported decisions by recipe ID and preserves custom title, author, URL, servings, ingredients and method.
- Reports unmatched recipes without writing to Supabase.

## v0.14.1 — Repair plan validation

- Blocks Ready when selected data contains high-risk corruption or contamination.
- Flags no-op decisions, social copy, nutrition text in methods, malformed fractions, suspicious large weights, truncated lines and ingredient-only method steps.
- Adds Blocked filter and valid/blocked counters.
- Exports repair-plan-v2 with validation and changed fields.
- Reopens a decision automatically whenever its field selection changes.

# Recipe Library v0.14.0

- Adds a read-only repair workspace at `/recipe-repair`.
- Lets the administrator choose saved, Parser v2, or custom values for title, author, URL, servings, ingredients, and method.
- Stores review decisions locally in the browser.
- Exports a versioned JSON repair plan with optimistic-concurrency timestamps.
- Does not write to Supabase or modify recipes.

## v0.13.1

- Adds a full JSON diagnostics export with raw source text and saved/parsed ingredient and method content.
- Keeps the compact CSV as a summary export.
- Remains fully read-only; no Supabase writes.

# Changelog

## v0.13.0 — Read-only existing recipe audit
- Adds an administrator-only audit at `/recipe-audit`.
- Reads all existing recipes from Supabase and reparses `raw_source_text` locally with Parser v2.
- Classifies recipes as looks correct, safe repair candidate, needs review or no original text.
- Shows saved and reparsed title, author, ingredients and method side by side.
- Exports the complete audit as CSV.
- Performs no database writes and offers no repair action yet.

## v0.12.2 — Compact social paste fix
- Reconstructs Facebook, Instagram and TikTok captions copied as one continuous line.
- Separates URL, profile author, audio attribution, title, ingredient headings, ingredient rows and numbered method steps before parsing.
- Adds the exact single-line Coconut and Bliss Facebook Reel copy as a permanent regression fixture.
- Regression suite reaches 61/61 passing fixtures.

## v0.12.1 — Social copy fixes
- Recognizes the profile name as author when Facebook, Instagram or TikTok copied text includes Follow/Seguir chrome.
- Skips social separators and audio attribution when choosing the recipe title.
- Detects numbered preparation steps even when the copied caption has no Method/Preparation heading.
- Keeps To Serve as an ingredient subsection when it appears before the method.
- Regression suite reaches 60/60 passing fixtures.

## v0.3.1

### Added
- Next.js frontend foundation
- Responsive global navigation
- Home, Browse, Recipe detail, Collections and Paste Recipe
- Mock recipe library
- Nutrition strip and ingredient checklist

## v0.12.0 — Parser v2
- Rebuilt ingredient parsing for quantities, units, connectors, package weights and notes.
- Rebuilt recipe method parsing for numbered, labelled, emoji and Markdown steps.
- Improved social-caption, NYT and Spanish blog parsing.
- Parser regression suite reaches 59/59 passing fixtures.
- Existing database recipes remain untouched.
