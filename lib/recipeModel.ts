export const RECIPE_SCHEMA_VERSION = 3 as const;

export type RecipeStatus =
  | "to_try"
  | "this_weekend"
  | "tested"
  | "favorite"
  | "discarded";

export type RecipeVisibility = "private" | "unlisted" | "public";

export type NutritionScope = "per_serving" | "whole_recipe";

export type NumericRange = {
  min: number | null;
  max: number | null;
};

export type RecipeSource = {
  author: string | null;
  publication: string | null;
  originalUrl: string | null;
};

export type RecipeYield = {
  servings: number | null;
  servingsDisplay: string | null;
  timeDisplay: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restingMinutes: number | null;
  marinatingMinutes: number | null;
  totalMinutes: number | null;
};

export type RecipeIngredient = {
  id: string;
  originalLine: string;
  canonicalIngredient: string | null;
  quantity: NumericRange;
  unit: string | null;
  preparationNote: string | null;
  optional: boolean;
  garnish: boolean;
  servingAccompaniment: boolean;
};

export type RecipeIngredientSection = {
  id: string;
  title: string | null;
  items: RecipeIngredient[];
};

export type RecipeStep = {
  id: string;
  title: string | null;
  body: string;
  durationMinutes: number | null;
  temperatureC: number | null;
};

export type RecipeMethodSection = {
  id: string;
  title: string | null;
  steps: RecipeStep[];
};

export type RecipeNutrition = {
  scope: NutritionScope;
  calories: NumericRange;
  proteinG: NumericRange;
  carbohydratesG: NumericRange;
  fatG: NumericRange;
  fiberG: NumericRange;
  includesSides: boolean | null;
  note: string | null;
};

export type RecipeClassification = {
  mainIngredients: string[];
  dishTypes: string[];
  cookingMethods: string[];
  cuisines: string[];
  collections: string[];
};

export type RecipePersonal = {
  status: RecipeStatus;
  tested: boolean;
  favorite: boolean;
  thisWeekend: boolean;
  rating: number | null;
  privateNotes: string | null;
  timesCooked: number;
  lastCookedAt: string | null;
};

export type RecipeMedia = {
  heroImage: string | null;
};

export type Recipe = {
  schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  source: RecipeSource;
  yield: RecipeYield;
  ingredientSections: RecipeIngredientSection[];
  methodSections: RecipeMethodSection[];
  servingSuggestion: string | null;
  publicNotes: string | null;
  nutrition: RecipeNutrition;
  classification: RecipeClassification;
  personal: RecipePersonal;
  media: RecipeMedia;
  visibility: RecipeVisibility;
  rawSourceText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeInput = {
  title: string;
  author?: string;
  publication?: string;
  originalUrl?: string;
  servings?: string;
  time?: string;
  ingredients?: string[];
  method?: { title: string; body: string }[];
  calories?: { min: string; max: string };
  protein?: { min: string; max: string };
  carbs?: { min: string; max: string };
  fat?: { min: string; max: string };
  fiber?: { min: string; max: string };
  servingSuggestion?: string;
  mainIngredients?: string[];
  dishTypes?: string[];
  methods?: string[];
  cuisines?: string[];
  collections?: string[];
  tested?: boolean;
  favorite?: boolean;
  thisWeekend?: boolean;
  rating?: number | null;
  rawSourceText?: string;
  image?: string;
};

export type RecipeValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function unique(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function parseNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toNumericRange(value?: {
  min: string;
  max: string;
}): NumericRange {
  const min = parseNullableNumber(value?.min);
  const max = parseNullableNumber(value?.max);
  return {
    min,
    max: max ?? min,
  };
}

export function createEntityId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugifyRecipeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function parseServings(value?: string) {
  if (!value) return null;
  const match = value.match(/\d+(?:[.,]\d+)?/);
  return match ? parseNullableNumber(match[0]) : null;
}

export function createRecipeFromInput(input: RecipeInput): Recipe {
  const now = new Date().toISOString();
  const id = createEntityId("recipe");
  const title = input.title.trim();
  const slugBase = slugifyRecipeTitle(title) || "recipe";

  return {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id,
    slug: `${slugBase}-${id.slice(-8)}`,
    title,
    summary: null,
    source: {
      author: input.author?.trim() || null,
      publication: input.publication?.trim() || null,
      originalUrl: input.originalUrl?.trim() || null,
    },
    yield: {
      servings: parseServings(input.servings),
      servingsDisplay: input.servings?.trim() || null,
      timeDisplay: input.time?.trim() || null,
      prepMinutes: null,
      cookMinutes: null,
      restingMinutes: null,
      marinatingMinutes: null,
      totalMinutes: null,
    },
    ingredientSections: [
      {
        id: createEntityId("ingredient_section"),
        title: null,
        items: (input.ingredients ?? []).map((originalLine) => ({
          id: createEntityId("ingredient"),
          originalLine: originalLine.trim(),
          canonicalIngredient: null,
          quantity: { min: null, max: null },
          unit: null,
          preparationNote: null,
          optional: false,
          garnish: false,
          servingAccompaniment: false,
        })),
      },
    ],
    methodSections: [
      {
        id: createEntityId("method_section"),
        title: null,
        steps: (input.method ?? []).map((step) => ({
          id: createEntityId("step"),
          title: step.title.trim() || null,
          body: step.body.trim(),
          durationMinutes: null,
          temperatureC: null,
        })),
      },
    ],
    servingSuggestion: input.servingSuggestion?.trim() || null,
    publicNotes: null,
    nutrition: {
      scope: "per_serving",
      calories: toNumericRange(input.calories),
      proteinG: toNumericRange(input.protein),
      carbohydratesG: toNumericRange(input.carbs),
      fatG: toNumericRange(input.fat),
      fiberG: toNumericRange(input.fiber),
      includesSides: null,
      note: null,
    },
    classification: {
      mainIngredients: unique(input.mainIngredients ?? []),
      dishTypes: unique(input.dishTypes ?? []),
      cookingMethods: unique(input.methods ?? []),
      cuisines: unique(input.cuisines ?? []),
      collections: unique(input.collections ?? []),
    },
    personal: {
      status: input.thisWeekend
        ? "this_weekend"
        : input.favorite
          ? "favorite"
          : input.tested
            ? "tested"
            : "to_try",
      tested: input.tested ?? false,
      favorite: input.favorite ?? false,
      thisWeekend: input.thisWeekend ?? false,
      rating:
        input.rating === null || input.rating === undefined
          ? null
          : Math.min(5, Math.max(1, Math.round(input.rating))),
      privateNotes: null,
      timesCooked: 0,
      lastCookedAt: null,
    },
    media: {
      heroImage: input.image?.trim() || null,
    },
    visibility: "private",
    rawSourceText: input.rawSourceText ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateRecipe(recipe: Recipe): RecipeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!recipe.title.trim()) {
    errors.push("A title is required.");
  }

  const ingredientCount = recipe.ingredientSections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const stepCount = recipe.methodSections.reduce(
    (total, section) => total + section.steps.length,
    0,
  );

  if (ingredientCount === 0 && stepCount === 0) {
    errors.push("Add at least one ingredient or method step.");
  }

  if (!recipe.source.author) warnings.push("Author not provided.");
  if (!recipe.source.publication) warnings.push("Publication not provided.");
  if (!recipe.yield.servingsDisplay) warnings.push("Servings not provided.");
  if (!recipe.yield.timeDisplay) warnings.push("Time not provided.");
  if (recipe.nutrition.calories.min === null) {
    warnings.push("Calories not provided.");
  }
  if (recipe.nutrition.fiberG.min === null) {
    warnings.push("Fiber not provided.");
  }
  if (
    recipe.personal.rating !== null &&
    (recipe.personal.rating < 1 || recipe.personal.rating > 5)
  ) {
    errors.push("Rating must be between 1 and 5.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function formatRange(
  range: NumericRange,
  suffix = "",
  fallback = "—",
) {
  if (range.min === null) return fallback;
  if (range.max !== null && range.max !== range.min) {
    return `${range.min}–${range.max}${suffix}`;
  }
  return `${range.min}${suffix}`;
}

export function getRecipeIngredients(recipe: Recipe) {
  return recipe.ingredientSections.flatMap((section) => section.items);
}

export function getRecipeSteps(recipe: Recipe) {
  return recipe.methodSections.flatMap((section) => section.steps);
}
