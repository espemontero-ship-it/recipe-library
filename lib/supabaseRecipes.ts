import { Recipe, RECIPE_SCHEMA_VERSION } from "@/lib/recipeModel";
import { getSupabaseClient } from "@/lib/supabase";

const RECIPE_TABLE = "recipes_clean_v14_final";

type RecipeRow = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  tested: boolean | null;
  favorite: boolean | null;
  this_weekend: boolean | null;
  rating: number | null;
  servings: number | null;
  servings_display: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  source_author: string | null;
  source_type: string | null;
  source_url: string | null;
  cover_image: string | null;
  time_display: string | null;
  total_time_minutes: number | null;
  ingredients_raw: unknown;
  ingredient_sections: unknown;
  method: unknown;
  ingredients_index: string[] | null;
  dish: string[] | null;
  format: string[] | null;
  meal_type: string[] | null;
  cooking_methods: string[] | null;
  cuisines: string[] | null;
  collections: string[] | null;
  notes: unknown;
  raw_source_text: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function asNotes(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  const notes = asStringArray(value);
  return notes.length ? notes.join("\n\n") : null;
}

function ingredientItems(recipeId: string, sectionIndex: number, lines: string[]) {
  return lines.map((originalLine, itemIndex) => ({
    id: `${recipeId}_ingredient_${sectionIndex}_${itemIndex}`,
    originalLine,
    canonicalIngredient: null,
    quantity: { min: null, max: null },
    unit: null,
    preparationNote: null,
    optional: false,
    garnish: false,
    servingAccompaniment: false,
  }));
}

function asIngredientSections(
  recipeId: string,
  value: unknown,
  fallbackLines: string[],
): Recipe["ingredientSections"] {
  if (Array.isArray(value)) {
    const sections = value
      .map((item, sectionIndex) => {
        if (!item || typeof item !== "object") return null;
        const section = item as { title?: unknown; items?: unknown };
        const lines = asStringArray(section.items);
        if (!lines.length) return null;

        return {
          id: `${recipeId}_ingredient_section_${sectionIndex}`,
          title: typeof section.title === "string" && section.title.trim()
            ? section.title.trim()
            : null,
          items: ingredientItems(recipeId, sectionIndex, lines),
        };
      })
      .filter((section): section is NonNullable<typeof section> => section !== null);

    if (sections.length) return sections;
  }

  return [{
    id: `${recipeId}_ingredient_section_0`,
    title: null,
    items: ingredientItems(recipeId, 0, fallbackLines),
  }];
}

function asMethod(value: unknown): { title: string | null; body: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === "string" && item.trim()) {
        return { title: null, body: item.trim() };
      }
      if (item && typeof item === "object") {
        const row = item as { title?: unknown; body?: unknown };
        const body = typeof row.body === "string" ? row.body.trim() : "";
        if (!body) return null;
        return {
          title: typeof row.title === "string" && row.title.trim()
            ? row.title.trim()
            : null,
          body,
        };
      }
      return null;
    })
    .filter((item): item is { title: string | null; body: string } => item !== null)
    .map((item, index) => ({
      title: item.title ?? `Step ${index + 1}`,
      body: item.body,
    }));
}

function range(value: number | null) {
  return { min: value, max: value };
}

export function mapRecipeRow(row: RecipeRow): Recipe {
  const ingredientLines = asStringArray(row.ingredients_raw);
  const method = asMethod(row.method);
  const createdAt = row.created_at || new Date(0).toISOString();
  const updatedAt = row.updated_at || createdAt;

  let status: Recipe["personal"]["status"] = "to_try";
  if (row.favorite) status = "favorite";
  else if (row.this_weekend) status = "this_weekend";
  else if (row.tested) status = "tested";

  return {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    summary: row.summary,
    source: {
      author: row.source_author,
      type: row.source_type,
      publication: null,
      originalUrl: row.source_url,
    },
    yield: {
      servings: row.servings,
      servingsDisplay: row.servings_display ?? (row.servings ? `${row.servings} servings` : null),
      timeDisplay: row.time_display,
      prepMinutes: null,
      cookMinutes: null,
      restingMinutes: null,
      marinatingMinutes: null,
      totalMinutes: row.total_time_minutes,
    },
    ingredientSections: asIngredientSections(
      row.id,
      row.ingredient_sections,
      ingredientLines,
    ),
    methodSections: [{
      id: `${row.id}_method`,
      title: null,
      steps: method.map((step, index) => ({
        id: `${row.id}_step_${index}`,
        title: step.title,
        body: step.body,
        durationMinutes: null,
        temperatureC: null,
      })),
    }],
    servingSuggestion: null,
    publicNotes: asNotes(row.notes),
    nutrition: {
      scope: "per_serving",
      calories: range(row.calories),
      proteinG: range(row.protein),
      carbohydratesG: range(row.carbs),
      fatG: range(row.fat),
      fiberG: range(row.fiber),
      includesSides: null,
      note: null,
    },
    classification: {
      ingredientsIndex: row.ingredients_index ?? [],
      dish: row.dish ?? [],
      formats: row.format ?? [],
      mealTypes: row.meal_type ?? [],
      cookingMethods: row.cooking_methods ?? [],
      cuisines: row.cuisines ?? [],
      collections: row.collections ?? [],
      mainIngredients: row.ingredients_index ?? [],
      dishTypes: [...(row.dish ?? []), ...(row.format ?? [])],
    },
    personal: {
      status,
      tested: Boolean(row.tested),
      favorite: Boolean(row.favorite),
      thisWeekend: Boolean(row.this_weekend),
      rating: row.rating,
      privateNotes: null,
      timesCooked: row.tested ? 1 : 0,
      lastCookedAt: null,
    },
    media: { heroImage: row.cover_image },
    visibility: "private",
    rawSourceText: row.raw_source_text,
    createdAt,
    updatedAt,
  };
}

export async function getSupabaseRecipes(): Promise<Recipe[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");

  const { data, error } = await supabase
    .from(RECIPE_TABLE)
    .select("*")
    .order("title", { ascending: true });

  if (error) throw error;
  return (data as RecipeRow[]).map(mapRecipeRow);
}

export async function getSupabaseRecipe(idOrSlug: string): Promise<Recipe | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug);

  const query = supabase
    .from(RECIPE_TABLE)
    .select("*");

  const { data, error } = isUuid
    ? await query.eq("id", idOrSlug).maybeSingle()
    : await query.eq("slug", idOrSlug).maybeSingle();

  if (error) throw error;
  return data ? mapRecipeRow(data as RecipeRow) : null;
}
