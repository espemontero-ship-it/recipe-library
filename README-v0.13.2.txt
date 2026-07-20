RECIPE LIBRARY v0.13.2 — PARSER CORPUS REPAIR

This patch uses the full 542-recipe read-only diagnostic export to improve broad parser patterns.

WHAT CHANGES
- Ingredient lists without an explicit Ingredients heading are recovered more reliably.
- Food emojis, check marks and decorated social-media headings are handled.
- Numbered, keycap-emoji, bullet and action-paragraph methods are recovered even without a Method heading.
- Spanish quantities, Unicode fractions, package units and ingredient-first measurements are improved.
- Ingredient subsection labels are preserved as sections in the paste review.
- The audit compares equivalent content more intelligently and avoids many false review flags.

WHAT DOES NOT CHANGE
- No recipe is modified automatically.
- No Supabase writes are performed by the audit.
- No SQL is required.
- The remaining review recipes are not assumed safe to repair.

INSTALLATION
1. Stop Recipe Library with Ctrl+C.
2. Run INSTALL.bat from this folder.
3. Start the project with npm run dev.
4. Open http://localhost:3000/recipe-audit and press Refresh audit.

The parser regression suite passes 77/77 cases.
