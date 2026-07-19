RECIPE LIBRARY v0.8.1 — PERSONAL STATE + DOCX HISTORY

Do not install v0.8.0. This package replaces it.

Recovered from the original DOCX:
- Next and Weekend => this_weekend = true
- Sections without "not tested" => tested = true
- Sections containing "not tested" => tested = false
- A => 5 stars
- B => 4 stars
- C => 3 stars

Expected database totals:
- total: 535
- tested: 79
- this_weekend: 195
- rated: 36
- five_stars: 31
- four_stars: 4
- three_stars: 1

Database:
1. Run supabase/00_create_personal_history_staging.sql.
2. Import supabase/recipe-personal-history-v081-staging.csv into the staging table.
3. Run supabase/01_apply_personal_history.sql. Expected matched_rows = 535.
4. Run supabase/02_validate_personal_history.sql.

Application:
1. Stop npm run dev.
2. Copy app, components and lib over the project folders.
3. Confirm replacement.
4. Run npm run dev.
5. Open http://localhost:3000, not the local-network IP.

The app adds:
- Favorite
- Tested
- This Weekend
- 1–5 star rating
- Private notes
- Personal filters in Browse
- Real Favorite and This Weekend sections on Home

New manual changes are stored in this browser for now. Historical defaults come from Supabase.
