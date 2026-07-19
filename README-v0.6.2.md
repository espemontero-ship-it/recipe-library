# Recipe Library v0.6.2

- Reads the validated 535-recipe dataset from `public.recipes_clean_v14_final`.
- Preserves ingredient sections such as sauce, dressing, mash and toppings.
- Reads notes stored as JSON arrays.
- Shows the exact servings label without adding a second “servings”.
- Sorts the library alphabetically.
- Removes fake placeholder food images when a recipe has no image.
- Leaves the old `public.recipes` and `public.recipes_clean_v14` tables untouched.
