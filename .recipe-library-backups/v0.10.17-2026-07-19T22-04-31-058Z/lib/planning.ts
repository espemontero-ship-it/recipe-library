"use client";

import type { Recipe } from "@/lib/recipeModel";

const STORAGE_KEY = "recipe-library:planning:v2";
const LEGACY_STORAGE_KEY = "recipe-library:weekly-plan:v1";
export const PLANNING_EVENT = "recipe-library:planning-updated";

export type PlanningItem = {
  id: string;
  recipeId: string;
  weekStart: string;
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

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekStart(value: Date | string = new Date()) {
  const date =
    typeof value === "string" ? parseDateOnly(value) ?? new Date() : new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateKey(date);
}

export function addWeeks(weekStart: string, amount: number) {
  const date = parseDateOnly(getWeekStart(weekStart)) ?? new Date();
  date.setDate(date.getDate() + amount * 7);
  return dateKey(date);
}

export function formatPlanningWeekLabel(weekStart: string) {
  const normalized = getWeekStart(weekStart);
  const current = getWeekStart();
  const next = addWeeks(current, 1);

  if (normalized === current) return "This week";
  if (normalized === next) return "Next week";

  const date = parseDateOnly(normalized);
  if (!date) return normalized;
  return `Week of ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date)}`;
}

export function getPlanningWeekOptions(count = 12) {
  const current = getWeekStart();
  return Array.from({ length: count + 1 }, (_, index) => {
    const weekStart = addWeeks(current, index);
    return { weekStart, label: formatPlanningWeekLabel(weekStart) };
  });
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

function createId(recipeId: string, weekStart: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${recipeId}:${weekStart}:${random}`;
}

function normalizeItem(value: unknown): PlanningItem | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PlanningItem>;
  if (!candidate.recipeId || typeof candidate.recipeId !== "string") return null;

  const now = new Date().toISOString();
  const weekStart = getWeekStart(
    typeof candidate.weekStart === "string" ? candidate.weekStart : new Date(),
  );

  return {
    id:
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : createId(candidate.recipeId, weekStart),
    recipeId: candidate.recipeId,
    weekStart,
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

function writePlanning(items: PlanningItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(PLANNING_EVENT));
}

function migrateLegacyPlan() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const currentWeek = getWeekStart();
    const migrated = parsed
      .map((value) => {
        if (!value || typeof value !== "object") return null;
        const legacy = value as {
          recipeId?: unknown;
          servings?: unknown;
          includeInShopping?: unknown;
          addedAt?: unknown;
          updatedAt?: unknown;
        };
        if (typeof legacy.recipeId !== "string" || !legacy.recipeId) return null;
        const now = new Date().toISOString();
        return {
          id: createId(legacy.recipeId, currentWeek),
          recipeId: legacy.recipeId,
          weekStart: currentWeek,
          servings: sanitizeServings(legacy.servings),
          includeInShopping: legacy.includeInShopping !== false,
          addedAt: typeof legacy.addedAt === "string" ? legacy.addedAt : now,
          updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : now,
        } satisfies PlanningItem;
      })
      .filter((item): item is PlanningItem => Boolean(item));

    if (migrated.length) writePlanning(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function getPlanning(): PlanningItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateLegacyPlan();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeItem)
      .filter((item): item is PlanningItem => Boolean(item));
  } catch {
    return [];
  }
}

export function addRecipesToPlanning(
  recipes: Recipe[],
  weekStart = getWeekStart(),
) {
  const targetWeek = getWeekStart(weekStart);
  const current = getPlanning();
  const existingKeys = new Set(
    current.map((item) => `${item.recipeId}:${item.weekStart}`),
  );
  const now = new Date().toISOString();

  const additions = recipes
    .filter((recipe) => !existingKeys.has(`${recipe.id}:${targetWeek}`))
    .map((recipe) => ({
      id: createId(recipe.id, targetWeek),
      recipeId: recipe.id,
      weekStart: targetWeek,
      servings: getRecipeDefaultServings(recipe),
      includeInShopping: true,
      addedAt: now,
      updatedAt: now,
    }));

  if (additions.length) writePlanning([...current, ...additions]);
  return additions.length;
}

export function updatePlanningItem(
  itemId: string,
  patch: Partial<
    Pick<PlanningItem, "servings" | "includeInShopping" | "weekStart">
  >,
) {
  const now = new Date().toISOString();
  const updated = getPlanning().map((item) =>
    item.id === itemId
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
          weekStart:
            patch.weekStart === undefined
              ? item.weekStart
              : getWeekStart(patch.weekStart),
          updatedAt: now,
        }
      : item,
  );
  writePlanning(updated);
}

export function movePlanningItem(
  itemId: string,
  targetWeekStart: string,
  replaceDuplicate = false,
) {
  const current = getPlanning();
  const item = current.find((candidate) => candidate.id === itemId);
  if (!item) return { moved: false, duplicate: false };

  const weekStart = getWeekStart(targetWeekStart);
  const duplicate = current.find(
    (candidate) =>
      candidate.id !== itemId &&
      candidate.recipeId === item.recipeId &&
      candidate.weekStart === weekStart,
  );

  if (duplicate && !replaceDuplicate) {
    return { moved: false, duplicate: true };
  }

  const now = new Date().toISOString();
  const withoutDuplicate = duplicate
    ? current.filter((candidate) => candidate.id !== duplicate.id)
    : current;
  const updated = withoutDuplicate.map((candidate) =>
    candidate.id === itemId
      ? { ...candidate, weekStart, updatedAt: now }
      : candidate,
  );
  writePlanning(updated);
  return { moved: true, duplicate: Boolean(duplicate) };
}

export function removePlanningItem(itemId: string) {
  writePlanning(getPlanning().filter((item) => item.id !== itemId));
}

export function clearPlanningWeek(weekStart: string) {
  const normalized = getWeekStart(weekStart);
  writePlanning(getPlanning().filter((item) => item.weekStart !== normalized));
}

export function subscribeToPlanning(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) callback();
  };

  window.addEventListener(PLANNING_EVENT, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PLANNING_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}
