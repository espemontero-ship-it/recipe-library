"use client";

import {
  createRecipeFromInput,
  Recipe,
  RecipeInput,
  RECIPE_SCHEMA_VERSION,
  validateRecipe,
} from "@/lib/recipeModel";

const STORAGE_KEY = "recipe-library:recipes";

type StorageEnvelope = {
  schemaVersion: typeof RECIPE_SCHEMA_VERSION;
  recipes: Recipe[];
};

type LegacyRecipe = {
  id?: string;
  title?: string;
  author?: string;
  publication?: string;
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
  methods?: string[];
  dishTypes?: string[];
  cuisines?: string[];
  collections?: string[];
  tested?: boolean;
  favorite?: boolean;
  thisWeekend?: boolean;
  rating?: number | null;
  image?: string;
  createdAt?: string;
};

type PreviousRecipe = Omit<Recipe, "schemaVersion" | "personal"> & {
  schemaVersion?: number;
  personal: Recipe["personal"] & {
    tested?: boolean;
    favorite?: boolean;
    thisWeekend?: boolean;
  };
};

function isStructuredRecipe(value: unknown): value is PreviousRecipe {
  if (!value || typeof value !== "object") return false;
  return (
    "source" in value &&
    "nutrition" in value &&
    "classification" in value &&
    "personal" in value
  );
}

function normalizeRecipe(recipe: PreviousRecipe): Recipe {
  const oldStatus = recipe.personal.status;

  return {
    ...recipe,
    schemaVersion: RECIPE_SCHEMA_VERSION,
    personal: {
      ...recipe.personal,
      tested: recipe.personal.tested ?? oldStatus === "tested",
      favorite: recipe.personal.favorite ?? oldStatus === "favorite",
      thisWeekend:
        recipe.personal.thisWeekend ?? oldStatus === "this_weekend",
      rating: recipe.personal.rating ?? null,
    },
  } as Recipe;
}

function migrateLegacyRecipe(legacy: LegacyRecipe): Recipe {
  const migrated = createRecipeFromInput({
    title: legacy.title || "Untitled recipe",
    author: legacy.author,
    publication: legacy.publication,
    servings: legacy.servings,
    time: legacy.time,
    ingredients: legacy.ingredients,
    method: legacy.method,
    calories: legacy.calories,
    protein: legacy.protein,
    carbs: legacy.carbs,
    fat: legacy.fat,
    fiber: legacy.fiber,
    servingSuggestion: legacy.servingSuggestion,
    mainIngredients: legacy.mainIngredients,
    methods: legacy.methods,
    dishTypes: legacy.dishTypes,
    cuisines: legacy.cuisines,
    collections: legacy.collections,
    tested: legacy.tested,
    favorite: legacy.favorite,
    thisWeekend: legacy.thisWeekend,
    rating: legacy.rating,
    image: legacy.image,
  });

  return {
    ...migrated,
    id: legacy.id || migrated.id,
    createdAt: legacy.createdAt || migrated.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function writeEnvelope(envelope: StorageEnvelope) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  window.dispatchEvent(new Event("recipe-library:updated"));
}

function readEnvelope(): StorageEnvelope {
  if (typeof window === "undefined") {
    return { schemaVersion: RECIPE_SCHEMA_VERSION, recipes: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { schemaVersion: RECIPE_SCHEMA_VERSION, recipes: [] };
    }

    const parsed: unknown = JSON.parse(raw);
    let recipes: Recipe[] = [];

    if (
      parsed &&
      typeof parsed === "object" &&
      "recipes" in parsed &&
      Array.isArray((parsed as { recipes: unknown[] }).recipes)
    ) {
      recipes = (parsed as { recipes: unknown[] }).recipes.map((item) =>
        isStructuredRecipe(item)
          ? normalizeRecipe(item)
          : migrateLegacyRecipe(item as LegacyRecipe),
      );
    } else if (Array.isArray(parsed)) {
      recipes = parsed.map((item) =>
        isStructuredRecipe(item)
          ? normalizeRecipe(item)
          : migrateLegacyRecipe(item as LegacyRecipe),
      );
    }

    const envelope = { schemaVersion: RECIPE_SCHEMA_VERSION, recipes };
    writeEnvelope(envelope);
    return envelope;
  } catch {
    return { schemaVersion: RECIPE_SCHEMA_VERSION, recipes: [] };
  }
}

export function getStoredRecipes(): Recipe[] {
  return readEnvelope().recipes.sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getStoredRecipe(id: string) {
  return getStoredRecipes().find((recipe) => recipe.id === id) ?? null;
}

export function saveRecipe(recipe: Recipe) {
  const validation = validateRecipe(recipe);
  if (!validation.valid) {
    throw new Error(validation.errors.join(" "));
  }

  const envelope = readEnvelope();
  const updatedRecipe = {
    ...recipe,
    schemaVersion: RECIPE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = envelope.recipes.findIndex(
    (item) => item.id === recipe.id,
  );

  if (existingIndex >= 0) {
    envelope.recipes[existingIndex] = updatedRecipe;
  } else {
    envelope.recipes.unshift(updatedRecipe);
  }

  writeEnvelope(envelope);
  return updatedRecipe;
}

export function createAndSaveRecipe(input: RecipeInput) {
  return saveRecipe(createRecipeFromInput(input));
}

export function deleteRecipe(id: string) {
  const envelope = readEnvelope();
  envelope.recipes = envelope.recipes.filter((recipe) => recipe.id !== id);
  writeEnvelope(envelope);
}

export function exportRecipeLibrary() {
  return JSON.stringify(readEnvelope(), null, 2);
}
