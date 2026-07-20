import {
  Recipe,
  RecipeIngredient,
  RecipeIngredientSection,
  RecipeInput,
  RecipeMethodSection,
  RECIPE_SCHEMA_VERSION,
  slugifyRecipeTitle,
} from "@/lib/recipeModel";
import { ingredientDisplayLine, parseIngredientLine } from "@/lib/ingredientParser";
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
  source_medium?: string | null;
  source_publication?: string | null;
  source_url: string | null;
  cover_image: string | null;
  time_display: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  resting_time_minutes?: number | null;
  marinating_time_minutes?: number | null;
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
  tags?: string[] | null;
  notes: unknown;
  qa?: unknown;
  raw_source_text: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function asRecipeNotes(value: unknown): {
  servingSuggestion: string | null;
  publicNotes: string | null;
  storageNotes: string | null;
  reheatingNotes: string | null;
  nutritionNotes: string | null;
} {
  if (typeof value === "string") {
    return {
      servingSuggestion: null,
      publicNotes: value.trim() || null,
      storageNotes: null,
      reheatingNotes: null,
      nutritionNotes: null,
    };
  }

  if (Array.isArray(value)) {
    const notes = asStringArray(value);
    return {
      servingSuggestion: null,
      publicNotes: notes.length ? notes.join("\n\n") : null,
      storageNotes: null,
      reheatingNotes: null,
      nutritionNotes: null,
    };
  }

  if (value && typeof value === "object") {
    const notes = value as {
      serving_suggestion?: unknown;
      public_notes?: unknown;
      storage_notes?: unknown;
      reheating_notes?: unknown;
      nutrition_notes?: unknown;
    };
    return {
      servingSuggestion:
        typeof notes.serving_suggestion === "string"
          ? notes.serving_suggestion.trim() || null
          : null,
      publicNotes:
        typeof notes.public_notes === "string"
          ? notes.public_notes.trim() || null
          : asStringArray(notes.public_notes).join("\n\n") || null,
      storageNotes:
        typeof notes.storage_notes === "string"
          ? notes.storage_notes.trim() || null
          : null,
      reheatingNotes:
        typeof notes.reheating_notes === "string"
          ? notes.reheating_notes.trim() || null
          : null,
      nutritionNotes:
        typeof notes.nutrition_notes === "string"
          ? notes.nutrition_notes.trim() || null
          : null,
    };
  }

  return {
    servingSuggestion: null,
    publicNotes: null,
    storageNotes: null,
    reheatingNotes: null,
    nutritionNotes: null,
  };
}

function validIngredient(item: unknown): RecipeIngredient | null {
  if (typeof item === "string") return parseIngredientLine(item);
  if (!item || typeof item !== "object") return null;

  const row = item as Partial<RecipeIngredient> & { originalLine?: unknown };
  const originalLine =
    typeof row.originalLine === "string" ? row.originalLine.trim() : "";
  const fallback = parseIngredientLine(originalLine);
  const hasStoredStructure =
    Object.prototype.hasOwnProperty.call(row, "canonicalIngredient") ||
    Object.prototype.hasOwnProperty.call(row, "quantity") ||
    Object.prototype.hasOwnProperty.call(row, "unit");

  const canonicalIngredient = hasStoredStructure
    ? typeof row.canonicalIngredient === "string"
      ? row.canonicalIngredient.trim() || null
      : null
    : fallback.canonicalIngredient;
  const quantity = hasStoredStructure && row.quantity && typeof row.quantity === "object"
    ? {
        min: typeof row.quantity.min === "number" ? row.quantity.min : null,
        max: typeof row.quantity.max === "number" ? row.quantity.max : null,
      }
    : fallback.quantity;
  const unit = hasStoredStructure
    ? typeof row.unit === "string"
      ? row.unit.trim() || null
      : null
    : fallback.unit;
  const preparationNote = hasStoredStructure
    ? typeof row.preparationNote === "string"
      ? row.preparationNote.trim() || null
      : null
    : fallback.preparationNote;

  const normalizedOriginal = originalLine.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedCanonical = canonicalIngredient?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
  const looksUnparsed =
    !canonicalIngredient ||
    (normalizedOriginal.length > 0 && normalizedCanonical === normalizedOriginal && /^\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(originalLine));
  const parseStatus = row.parseStatus === "review" || row.parseStatus === "confirmed"
    ? row.parseStatus
    : looksUnparsed
      ? "review"
      : "confirmed";

  const nutrition = row.nutrition && typeof row.nutrition === "object"
    ? row.nutrition
    : fallback.nutrition;
  return {
    ...fallback,
    ...row,
    id: typeof row.id === "string" && row.id ? row.id : fallback.id,
    originalLine,
    parseStatus,
    canonicalIngredient,
    quantity,
    unit,
    preparationNote,
    optional: Boolean(row.optional),
    garnish: Boolean(row.garnish),
    servingAccompaniment: Boolean(row.servingAccompaniment),
    // Legacy automatic nutrition matches are intentionally ignored.
    // Recipe macros are stored manually per serving at recipe level.
    nutrition: {
      status: "pending",
      fdcId: null,
      foodName: null,
      brandName: null,
      grams: null,
      per100g: null,
      note: null,
    },
  };
}

function asIngredientSections(
  recipeId: string,
  value: unknown,
  fallbackLines: string[],
): RecipeIngredientSection[] {
  if (Array.isArray(value)) {
    const sections = value
      .map((item, sectionIndex) => {
        if (!item || typeof item !== "object") return null;
        const section = item as { id?: unknown; title?: unknown; items?: unknown };
        const items = Array.isArray(section.items)
          ? section.items
              .map(validIngredient)
              .filter((ingredient): ingredient is RecipeIngredient => Boolean(ingredient))
          : [];
        if (!items.length) return null;
        return {
          id:
            typeof section.id === "string" && section.id
              ? section.id
              : `${recipeId}_ingredient_section_${sectionIndex}`,
          title:
            typeof section.title === "string" && section.title.trim()
              ? section.title.trim()
              : null,
          items,
        };
      })
      .filter(
        (section): section is RecipeIngredientSection => section !== null,
      );
    if (sections.length) return sections;
  }

  return [
    {
      id: `${recipeId}_ingredient_section_0`,
      title: null,
      items: fallbackLines.map(parseIngredientLine),
    },
  ];
}

function asMethodSections(recipeId: string, value: unknown): RecipeMethodSection[] {
  if (!Array.isArray(value)) return [];

  const structured = value
    .map((item, sectionIndex) => {
      if (!item || typeof item !== "object" || !Array.isArray((item as { steps?: unknown }).steps)) {
        return null;
      }
      const section = item as { id?: unknown; title?: unknown; steps: unknown[] };
      const steps = section.steps
        .map((step, stepIndex) => {
          if (!step || typeof step !== "object") return null;
          const row = step as {
            id?: unknown;
            title?: unknown;
            body?: unknown;
            durationMinutes?: unknown;
            temperatureC?: unknown;
          };
          const body = typeof row.body === "string" ? row.body.trim() : "";
          if (!body) return null;
          return {
            id:
              typeof row.id === "string" && row.id
                ? row.id
                : `${recipeId}_section_${sectionIndex}_step_${stepIndex}`,
            title:
              typeof row.title === "string" && row.title.trim()
                ? row.title.trim()
                : null,
            body,
            durationMinutes:
              typeof row.durationMinutes === "number" ? row.durationMinutes : null,
            temperatureC:
              typeof row.temperatureC === "number" ? row.temperatureC : null,
          };
        })
        .filter((step): step is NonNullable<typeof step> => step !== null);
      if (!steps.length) return null;
      return {
        id:
          typeof section.id === "string" && section.id
            ? section.id
            : `${recipeId}_method_section_${sectionIndex}`,
        title:
          typeof section.title === "string" && section.title.trim()
            ? section.title.trim()
            : null,
        steps,
      };
    })
    .filter((section): section is RecipeMethodSection => section !== null);

  if (structured.length) return structured;

  const grouped = new Map<string, RecipeMethodSection>();
  value.forEach((item, index) => {
    if (typeof item === "string" && item.trim()) {
      const key = "";
      if (!grouped.has(key)) {
        grouped.set(key, { id: `${recipeId}_method`, title: null, steps: [] });
      }
      grouped.get(key)!.steps.push({
        id: `${recipeId}_step_${index}`,
        title: null,
        body: item.trim(),
        durationMinutes: null,
        temperatureC: null,
      });
      return;
    }
    if (!item || typeof item !== "object") return;
    const row = item as {
      id?: unknown;
      title?: unknown;
      body?: unknown;
      durationMinutes?: unknown;
      temperatureC?: unknown;
      sectionTitle?: unknown;
    };
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!body) return;
    const sectionTitle =
      typeof row.sectionTitle === "string" ? row.sectionTitle.trim() : "";
    if (!grouped.has(sectionTitle)) {
      grouped.set(sectionTitle, {
        id: `${recipeId}_method_${grouped.size}`,
        title: sectionTitle || null,
        steps: [],
      });
    }
    grouped.get(sectionTitle)!.steps.push({
      id:
        typeof row.id === "string" && row.id
          ? row.id
          : `${recipeId}_step_${index}`,
      title:
        typeof row.title === "string" && row.title.trim()
          ? row.title.trim()
          : null,
      body,
      durationMinutes:
        typeof row.durationMinutes === "number" ? row.durationMinutes : null,
      temperatureC:
        typeof row.temperatureC === "number" ? row.temperatureC : null,
    });
  });

  return Array.from(grouped.values()).filter((section) => section.steps.length);
}

function inferSourceMedium(url: string | null, legacy: string | null) {
  if (!url) return legacy ? "web" : null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("facebook.com")) return "facebook";
    return "web";
  } catch {
    return legacy ? "web" : null;
  }
}

export function mapRecipeRow(row: RecipeRow): Recipe {
  const ingredientLines = asStringArray(row.ingredients_raw);
  const ingredientSections = asIngredientSections(
    row.id,
    row.ingredient_sections,
    ingredientLines,
  );
  const methodSections = asMethodSections(row.id, row.method);
  const createdAt = row.created_at || new Date(0).toISOString();
  const updatedAt = row.updated_at || createdAt;
  const notes = asRecipeNotes(row.notes);

  let status: Recipe["personal"]["status"] = "to_try";
  if (row.favorite) status = "favorite";
  else if (row.this_weekend) status = "this_weekend";
  else if (row.tested) status = "tested";

  const recipe: Recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    summary: row.summary,
    source: {
      author: row.source_author,
      type: row.source_medium ?? inferSourceMedium(row.source_url, row.source_type),
      publication: row.source_publication ?? row.source_type,
      originalUrl: row.source_url,
    },
    yield: {
      servings: row.servings,
      servingsDisplay:
        row.servings_display ?? (row.servings ? `${row.servings} servings` : null),
      timeDisplay: row.time_display,
      prepMinutes: row.prep_time_minutes ?? null,
      cookMinutes: row.cook_time_minutes ?? null,
      restingMinutes: row.resting_time_minutes ?? null,
      marinatingMinutes: row.marinating_time_minutes ?? null,
      totalMinutes: row.total_time_minutes,
    },
    ingredientSections,
    methodSections,
    servingSuggestion: notes.servingSuggestion,
    publicNotes: notes.publicNotes,
    storageNotes: notes.storageNotes,
    reheatingNotes: notes.reheatingNotes,
    nutritionNotes: notes.nutritionNotes,
    nutrition: {
      scope: "per_serving",
      calories: { min: row.calories, max: row.calories },
      proteinG: { min: row.protein, max: row.protein },
      carbohydratesG: { min: row.carbs, max: row.carbs },
      fatG: { min: row.fat, max: row.fat },
      fiberG: { min: row.fiber, max: row.fiber },
      includesSides: null,
      note: [row.calories, row.protein, row.carbs, row.fat, row.fiber].some((value) => value !== null)
        ? "Manual values per serving."
        : null,
    },
    classification: {
      ingredientsIndex: row.ingredients_index ?? [],
      dish: row.dish ?? [],
      formats: row.format ?? [],
      mealTypes: row.meal_type ?? [],
      cookingMethods: row.cooking_methods ?? [],
      cuisines: row.cuisines ?? [],
      collections: row.collections ?? [],
      tags: row.tags ?? [],
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
    },
    media: { heroImage: row.cover_image },
    visibility: "private",
    rawSourceText: row.raw_source_text,
    createdAt,
    updatedAt,
  };

  return recipe;
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
  const query = supabase.from(RECIPE_TABLE).select("*");
  const { data, error } = isUuid
    ? await query.eq("id", idOrSlug).maybeSingle()
    : await query.eq("slug", idOrSlug).maybeSingle();
  if (error) throw error;
  return data ? mapRecipeRow(data as RecipeRow) : null;
}

function parseFirstNumber(value?: string) {
  if (!value) return null;
  const match = value.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueNormalised(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) =>
          value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean),
    ),
  );
}

const METHOD_ALIASES: Record<string, string> = {
  "air fryer": "air_fryer",
  "air fry": "air_fryer",
  broiler: "broiled",
  broil: "broiled",
  grilled: "grill",
  grilling: "grill",
  "no cook": "no_cook",
  "ninja creami": "ninja_creami",
  "pressure cooker": "pressure_cooker",
  "rice cooker": "rice_cooker",
  "shallow fried": "shallow_fried",
  "slow cooker": "slow_cooker",
};

function normaliseMethods(values: string[] | undefined) {
  return uniqueNormalised(values).map((value) =>
    METHOD_ALIASES[value] ?? value.replace(/\s+/g, "_"),
  );
}

function methodRows(methodSections: RecipeMethodSection[]) {
  return methodSections.flatMap((section) =>
    section.steps.map((step) => ({
      id: step.id,
      title: step.title,
      body: step.body,
      durationMinutes: step.durationMinutes,
      temperatureC: step.temperatureC,
      sectionTitle: section.title,
    })),
  );
}

function recipeRow(recipe: Recipe) {
  const ingredientLines = recipe.ingredientSections.flatMap((section) =>
    section.items.map((item) => ingredientDisplayLine(item) || item.originalLine),
  );
  const ingredientSections = recipe.ingredientSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      nutrition: {
        status: "pending" as const,
        fdcId: null,
        foodName: null,
        brandName: null,
        grams: null,
        per100g: null,
        note: null,
      },
    })),
  }));

  return {
    title: recipe.title.trim(),
    slug: recipe.slug,
    summary: recipe.summary?.trim() || null,
    servings: recipe.yield.servings,
    servings_display: recipe.yield.servingsDisplay?.trim() || null,
    time_display: recipe.yield.timeDisplay?.trim() || null,
    prep_time_minutes: recipe.yield.prepMinutes,
    cook_time_minutes: recipe.yield.cookMinutes,
    resting_time_minutes: recipe.yield.restingMinutes,
    marinating_time_minutes: recipe.yield.marinatingMinutes,
    total_time_minutes: recipe.yield.totalMinutes,
    source_author: recipe.source.author?.trim() || null,
    source_type: recipe.source.publication?.trim() || null,
    source_medium: recipe.source.type?.trim() || null,
    source_publication: recipe.source.publication?.trim() || null,
    source_url: recipe.source.originalUrl?.trim() || null,
    cover_image: recipe.media.heroImage?.trim() || null,
    ingredients_raw: ingredientLines,
    ingredient_sections: ingredientSections,
    ingredients_index: uniqueNormalised(recipe.classification.ingredientsIndex),
    method: recipe.methodSections,
    notes: {
      serving_suggestion: recipe.servingSuggestion?.trim() || null,
      public_notes: recipe.publicNotes?.trim() || null,
      storage_notes: recipe.storageNotes?.trim() || null,
      reheating_notes: recipe.reheatingNotes?.trim() || null,
      nutrition_notes: recipe.nutritionNotes?.trim() || null,
    },
    dish: uniqueNormalised(recipe.classification.dish),
    format: uniqueNormalised(recipe.classification.formats),
    meal_type: uniqueNormalised(recipe.classification.mealTypes),
    cooking_methods: normaliseMethods(recipe.classification.cookingMethods),
    cuisines: uniqueNormalised(recipe.classification.cuisines),
    collections: uniqueNormalised(recipe.classification.collections),
    tags: uniqueNormalised(recipe.classification.tags),
    calories: recipe.nutrition.calories.min,
    protein: recipe.nutrition.proteinG.min,
    carbs: recipe.nutrition.carbohydratesG.min,
    fat: recipe.nutrition.fatG.min,
    fiber: recipe.nutrition.fiberG.min,
    qa: {
      canonical_nutrition_status: [
        recipe.nutrition.calories.min,
        recipe.nutrition.proteinG.min,
        recipe.nutrition.carbohydratesG.min,
        recipe.nutrition.fatG.min,
        recipe.nutrition.fiberG.min,
      ].every((value) => value !== null)
        ? "manual_per_serving_complete"
        : "manual_per_serving_incomplete",
    },
    updated_at: new Date().toISOString(),
  };
}

export async function updateSupabaseRecipe(recipe: Recipe): Promise<Recipe> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");
  if (!recipe.title.trim()) throw new Error("A title is required.");

  const nextSlug = slugifyRecipeTitle(recipe.title) || recipe.slug;
  const nextRecipe = { ...recipe, slug: nextSlug };
  const { data, error } = await supabase
    .from(RECIPE_TABLE)
    .update(recipeRow(nextRecipe))
    .eq("id", recipe.id)
    .select("*")
    .single();
  if (error) throw error;
  return mapRecipeRow(data as RecipeRow);
}

export async function createSupabaseRecipeFromRecipe(recipe: Recipe): Promise<Recipe> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");

  const title = recipe.title.trim();
  if (!title) throw new Error("Add a title before saving the recipe.");
  const slug = slugifyRecipeTitle(title);
  if (!slug) throw new Error("The title could not be converted into a recipe URL.");

  const { data: duplicate, error: duplicateError } = await supabase
    .from(RECIPE_TABLE)
    .select("id,title,slug")
    .eq("slug", slug)
    .neq("id", recipe.id)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) {
    throw new Error(`A recipe with this title already exists: ${duplicate.title}`);
  }

  const now = new Date().toISOString();
  const nextRecipe: Recipe = {
    ...recipe,
    slug,
    rawSourceText: recipe.rawSourceText?.trim() || null,
    createdAt: recipe.createdAt || now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from(RECIPE_TABLE)
    .insert({
      id: nextRecipe.id,
      ...recipeRow(nextRecipe),
      tested: nextRecipe.personal.tested,
      favorite: nextRecipe.personal.favorite,
      this_weekend: nextRecipe.personal.thisWeekend,
      rating: nextRecipe.personal.rating,
      raw_source_text: nextRecipe.rawSourceText,
      phase1_status: "complete",
      source_limitations: [],
      parser_issues: [],
      created_at: nextRecipe.createdAt,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A recipe with this title already exists.");
    throw error;
  }
  return mapRecipeRow(data as RecipeRow);
}

export async function createSupabaseRecipe(input: RecipeInput): Promise<Recipe> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");

  const title = input.title.trim();
  if (!title) throw new Error("Add a title before saving the recipe.");
  const slug = slugifyRecipeTitle(title);
  if (!slug) throw new Error("The title could not be converted into a recipe URL.");

  const { data: duplicate, error: duplicateError } = await supabase
    .from(RECIPE_TABLE)
    .select("id,title,slug")
    .eq("slug", slug)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) {
    throw new Error(`A recipe with this title already exists: ${duplicate.title}`);
  }

  const rawSourceText = input.rawSourceText?.trim();
  if (!rawSourceText) throw new Error("The original pasted text is required before saving.");

  const ingredients = input.ingredientSections ?? [
    {
      id: `ingredient_section_${crypto.randomUUID()}`,
      title: null,
      items: (input.ingredients ?? []).map(parseIngredientLine),
    },
  ];
  const methods = input.methodSections ?? [
    {
      id: `method_section_${crypto.randomUUID()}`,
      title: null,
      steps: (input.method ?? []).map((step) => ({
        id: `step_${crypto.randomUUID()}`,
        title: step.title.trim() || null,
        body: step.body.trim(),
        durationMinutes: null,
        temperatureC: null,
      })),
    },
  ];

  const recipe: Recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    slug,
    title,
    summary: input.summary?.trim() || null,
    source: {
      author: input.author?.trim() || null,
      type: input.sourceType?.trim() || null,
      publication: input.publication?.trim() || null,
      originalUrl: input.originalUrl?.trim() || null,
    },
    yield: {
      servings: parseFirstNumber(input.servings),
      servingsDisplay: input.servings?.trim() || null,
      timeDisplay: input.time?.trim() || null,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      restingMinutes: input.restingMinutes ?? null,
      marinatingMinutes: input.marinatingMinutes ?? null,
      totalMinutes: input.totalMinutes ?? null,
    },
    ingredientSections: ingredients,
    methodSections: methods,
    servingSuggestion: input.servingSuggestion?.trim() || null,
    publicNotes: input.publicNotes?.trim() || null,
    storageNotes: input.storageNotes?.trim() || null,
    reheatingNotes: input.reheatingNotes?.trim() || null,
    nutritionNotes: input.nutritionNotes?.trim() || null,
    nutrition: {
      scope: "per_serving",
      calories: {
        min: parseFirstNumber(input.calories?.min),
        max: parseFirstNumber(input.calories?.max ?? input.calories?.min),
      },
      proteinG: {
        min: parseFirstNumber(input.protein?.min),
        max: parseFirstNumber(input.protein?.max ?? input.protein?.min),
      },
      carbohydratesG: {
        min: parseFirstNumber(input.carbs?.min),
        max: parseFirstNumber(input.carbs?.max ?? input.carbs?.min),
      },
      fatG: {
        min: parseFirstNumber(input.fat?.min),
        max: parseFirstNumber(input.fat?.max ?? input.fat?.min),
      },
      fiberG: {
        min: parseFirstNumber(input.fiber?.min),
        max: parseFirstNumber(input.fiber?.max ?? input.fiber?.min),
      },
      includesSides: null,
      note: "Manual values per serving.",
    },
    classification: {
      ingredientsIndex: input.mainIngredients ?? [],
      dish: input.dish ?? [],
      formats: input.formats ?? input.dishTypes ?? [],
      mealTypes: input.mealTypes ?? [],
      cookingMethods: input.methods ?? [],
      cuisines: input.cuisines ?? [],
      collections: input.collections ?? [],
      tags: input.tags ?? [],
      mainIngredients: input.mainIngredients ?? [],
      dishTypes: [...(input.dish ?? []), ...(input.formats ?? input.dishTypes ?? [])],
    },
    personal: {
      status: "to_try",
      tested: false,
      favorite: false,
      thisWeekend: false,
      rating: null,
      privateNotes: null,
    },
    media: { heroImage: input.image?.trim() || null },
    visibility: "private",
    rawSourceText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(RECIPE_TABLE)
    .insert({
      id: recipe.id,
      ...recipeRow(recipe),
      tested: false,
      favorite: false,
      this_weekend: false,
      rating: null,
      raw_source_text: rawSourceText,
      phase1_status: "complete",
      source_limitations: [],
      parser_issues: [],
      created_at: recipe.createdAt,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("A recipe with this title already exists.");
    throw error;
  }
  return mapRecipeRow(data as RecipeRow);
}
