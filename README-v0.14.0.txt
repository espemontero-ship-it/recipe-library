RECIPE LIBRARY v0.14.0 — REPAIR WORKSPACE

This release adds a controlled review workspace for recipes flagged by the audit.

WHAT YOU CAN DO
- Open /recipe-repair from the administrator navigation.
- Review safe-repair and needs-review recipes one at a time.
- For title, author, source URL, servings, ingredients and method, choose:
  - Keep saved value
  - Use Parser v2 value
  - Enter a custom value
- Mark a recipe as Ready or Skip it for now.
- Keep decisions in this browser between sessions.
- Export a versioned JSON repair plan.

SAFETY
- This screen does not write to Supabase.
- It does not update, delete or repair any recipe.
- The exported plan contains each recipe's current updatedAt value so the future apply step can reject stale changes.
- No SQL is required.

INSTALLATION
1. Stop Recipe Library with Ctrl+C.
2. Run INSTALL.bat from this folder.
3. Start the project with npm run dev.
4. Sign in as administrator and open http://localhost:3000/recipe-repair.

The parser regression suite passes 77/77 cases and the production build passes.
