"use client";

import {
  createRecipeFromInput,
  Recipe,
  RecipeInput,
  RECIPE_SCHEMA_VERSION,
  validateRecipe,
} from "@/lib/recipeModel";

const STORAGE_KEY = "recipe-library:recipes";
const LEGACY_STORAGE_KEY = "recipe-library:recipes";

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
  image?: string;
  createdAt?: string;
};

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  return (
    "schemaVersion" in value &&
    (value as Recipe).schemaVersion === RECIPE_SCHEMA_VERSION &&
    "source" in value &&
    "nutrition" in value &&
    "classification" in value
  );
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
    image: legacy.image,
  });

  return {
    ...migrated,
    id: legacy.id || migrated.id,
    createdAt: legacy.createdAt || migrated.createdAt,
    updatedAt: new Date().toISOString(),
  };
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

    if (
      parsed &&
      typeof parsed === "object" &&
      "schemaVersion" in parsed &&
      "recipes" in parsed
    ) {
      const envelope = parsed as StorageEnvelope;
      return {
        schemaVersion: RECIPE_SCHEMA_VERSION,
        recipes: envelope.recipes.filter(isRecipe),
      };
    }

    if (Array.isArray(parsed)) {
      const recipes = parsed.map((item) =>
        isRecipe(item) ? item : migrateLegacyRecipe(item as LegacyRecipe),
      );
      const envelope = { schemaVersion: RECIPE_SCHEMA_VERSION, recipes };
      writeEnvelope(envelope);
      return envelope;
    }
  } catch {
    // Corrupt local data is isolated instead of breaking the app.
  }

  return { schemaVersion: RECIPE_SCHEMA_VERSION, recipes: [] };
}

function writeEnvelope(envelope: StorageEnvelope) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  window.dispatchEvent(new Event("recipe-library:updated"));
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
