# Changelog

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
