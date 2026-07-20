Recipe Library v0.11.3 — Manual macros per serving

This patch is based on v0.11.2.

What changed
- The automatic nutrition parser has been completely removed.
- Recipe Library no longer contacts FoodData Central or USDA.
- Ingredients are parsed only for recipe editing and the shopping list.
- The ingredient editor no longer shows nutrition matches, weights, searches or nutrition review states.
- Macros are entered manually per serving: calories, protein, carbohydrates, fat and fiber.
- Recipes may be saved with some or all macro fields blank.
- Existing numeric macro values already stored in Supabase are preserved and can be edited.
- Legacy automatic nutrition metadata inside ingredient JSON is ignored and removed the next time that recipe is explicitly saved.
- Opening a recipe does not change it.

Installation
1. Stop the development server with Ctrl+C.
2. Run INSTALL.bat on Windows or INSTALL.command on macOS/Linux.
3. Start the app with npm run dev.
4. Open a recipe and use Edit recipe.

SQL
- No SQL is required.

Important
- This patch does not repair old ingredient parsing or existing database recipes.
- We will audit and repair those separately, as agreed.
