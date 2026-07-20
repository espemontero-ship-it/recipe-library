RECIPE LIBRARY v0.15.0 — COMPLETE REPAIR BATCH

This release contains the completed repair batch generated from the full 542-recipe audit.

RESULT
- 237 recipes have prepared corrections.
- 305 recipes remain untouched because they were already correct or needed no change.
- 58 high-risk recipes received manual, recipe-specific corrections.
- 179 repeatable cases use validated automatic corrections.
- The plan contains 0 blocking validation findings.

INSTALL
1. Stop Recipe Library.
2. Run INSTALL.bat.
3. Start the app with: npm run dev
4. Open: http://localhost:3000/recipe-repair-batch
5. Click “Apply repairs”.

You do not need to upload another file, edit recipes one by one, run SQL, or approve hundreds of records.

SAFETY
- A rollback backup downloads automatically before the first database update.
- Recipes changed since the audit are skipped rather than overwritten.
- The backup can be restored from the same screen.
- Existing nutrition values are not recalculated or imported from source text.
