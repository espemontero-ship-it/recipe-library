Recipe Library v0.8.0 — Personal recipe state

Adds:
- Favorite, Tested and This Weekend controls on every recipe.
- Interactive 1–5 star rating.
- Private recipe notes.
- Personal filters in /browse.
- Personal icons and ratings on browse cards.
- Home sections show the recipes actually marked Favorite or This Weekend.
- Home search query now opens populated in /browse.
- Collections removed from navigation and home.
- No fake recipe images are added to personal sections.

Persistence:
- Personal state is stored in this browser with localStorage.
- It survives reloads and app restarts.
- No Supabase write policy or database migration is required.
- It is not yet synchronized across browsers or devices.

Install:
1. Stop npm run dev.
2. Copy app, components and lib over the matching project folders.
3. Confirm replacement.
4. Run npm run dev.
5. Open http://localhost:3000/browse

Validation:
- Mark one recipe Favorite, Tested and This Weekend.
- Add a rating and a private note.
- Reload the recipe: values must remain.
- Return home: Favorite and This Weekend sections must update.
- Use the new personal filters in /browse.

Build verified with Next.js 16.2.10.
