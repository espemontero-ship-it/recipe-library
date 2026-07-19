"use client";

import type { Recipe } from "@/lib/recipeModel";

const STORAGE_KEY = "recipe-library:weekly-plan:v1";
export const WEEKLY_PLAN_EVENT = "recipe-library:weekly-plan-updated";

export type WeeklyPlanItem = {
  recipeId: string;
  servings: number;
  includeInShopping: boolean;
  addedAt: string;
  updatedAt: string;
};

function sanitizeServings(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.round(parsed * 10) / 10;
}

export function getRecipeDefaultServings(recipe: Recipe) {
  if (recipe.yield.servings && recipe.yield.servings > 0) {
    return sanitizeServings(recipe.yield.servings);
  }

  const displayMatch = recipe.yield.servingsDisplay?.match(/\d+(?:[.,]\d+)?/);
  if (displayMatch) {
    return sanitizeServings(displayMatch[0].replace(",", "."));
  }

  return 1;
}

function normalizeItem(value: unknown): WeeklyPlanItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WeeklyPlanItem>;
  if (!candidate.recipeId || typeof candidate.recipeId !== "string") return null;

  const now = new Date().toISOString();
  return {
    recipeId: candidate.recipeId,
    servings: sanitizeServings(candidate.servings),
    includeInShopping: candidate.includeInShopping !== false,
    addedAt:
      typeof candidate.addedAt === "string" && candidate.addedAt
        ? candidate.addedAt
        : now,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt
        ? candidate.updatedAt
        : now,
  };
}

export function getWeeklyPlan(): WeeklyPlanItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeItem)
      .filter((item): item is WeeklyPlanItem => Boolean(item));
  } catch {
    return [];
  }
}

function saveWeeklyPlan(items: WeeklyPlanItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(WEEKLY_PLAN_EVENT));
}

export function addRecipesToWeeklyPlan(recipes: Recipe[]) {
  const current = getWeeklyPlan();
  const existingIds = new Set(current.map((item) => item.recipeId));
  const now = new Date().toISOString();

  const additions = recipes
    .filter((recipe) => !existingIds.has(recipe.id))
    .map((recipe) => ({
      recipeId: recipe.id,
      servings: getRecipeDefaultServings(recipe),
      includeInShopping: true,
      addedAt: now,
      updatedAt: now,
    }));

  if (additions.length) saveWeeklyPlan([...current, ...additions]);
  return additions.length;
}

export function updateWeeklyPlanItem(
  recipeId: string,
  patch: Partial<Pick<WeeklyPlanItem, "servings" | "includeInShopping">>,
) {
  const now = new Date().toISOString();
  const updated = getWeeklyPlan().map((item) =>
    item.recipeId === recipeId
      ? {
          ...item,
          servings:
            patch.servings === undefined
              ? item.servings
              : sanitizeServings(patch.servings),
          includeInShopping:
            patch.includeInShopping === undefined
              ? item.includeInShopping
              : patch.includeInShopping,
          updatedAt: now,
        }
      : item,
  );
  saveWeeklyPlan(updated);
}

export function removeRecipeFromWeeklyPlan(recipeId: string) {
  saveWeeklyPlan(getWeeklyPlan().filter((item) => item.recipeId !== recipeId));
}

export function clearWeeklyPlan() {
  saveWeeklyPlan([]);
}

export function subscribeToWeeklyPlan(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener(WEEKLY_PLAN_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(WEEKLY_PLAN_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}
