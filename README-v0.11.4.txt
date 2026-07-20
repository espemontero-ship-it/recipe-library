RECIPE LIBRARY v0.11.4 — PARSER TEST BENCH

This delivery does not change the parser and does not modify any recipe.
It adds a permanent test bench before development of Parser v2.

Included:
- 26 complete recipe fixtures.
- 33 ingredient-line fixtures.
- Visual report at /parser-lab.
- CLI baseline command: npm run test:parser.
- Strict regression command: npm run test:parser:strict.

Current v0.11.3 baseline:
- 19/26 complete recipe fixtures pass.
- 17/33 ingredient fixtures pass.
- 36/59 total pass; 23 failures are now permanently documented.

Installation:
1. Stop the app with Ctrl+C.
2. Place this folder inside the Recipe Library project, next to package.json.
3. Run INSTALL.bat.
4. Run npm run dev.
5. Open http://localhost:3000/parser-lab while signed in as admin.

No SQL is required.
