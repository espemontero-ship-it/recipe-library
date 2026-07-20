RECIPE LIBRARY v0.12.0 — PARSER v2

This release replaces the pasted-recipe and ingredient-line parser while leaving existing database recipes untouched.

Parser v2 improvements:
- 60g, 250gr, 100ml and other quantity/unit combinations without spaces.
- Spanish connectors are separated correctly: "60g de harina de arroz" becomes 60 | g | harina de arroz.
- Tablespoons, teaspoons, fractions, ranges and decimal commas.
- Cans, packets and pieces with parenthetical or inline weights.
- Preparation notes such as diced, grated, packed and halved.
- Spanish and English ingredient subsection headings.
- Numbered, Step/Paso, emoji-number and Markdown-bullet methods.
- NYT duplicate headings and editorial/navigation lines.
- Instagram, TikTok and Facebook captions, macros, hashtags and footer text.
- Spanish author lines such as "Receta de María López".

Regression suite:
- 26 complete recipe fixtures pass.
- 33 ingredient-line fixtures pass.
- 59/59 total pass.

Scope:
- Used for new pasted recipes and when explicitly reparsing an ingredient in the editor.
- Does not run a database migration.
- Does not bulk-rewrite existing recipes.
- Automatic nutrition matching remains removed; macros are manual per serving.

Installation:
1. Stop the app with Ctrl+C.
2. Place the extracted folder next to the project package.json.
3. Run INSTALL.bat.
4. Run npm run dev.

Optional regression check: npm run test:parser:strict
No SQL is required.
