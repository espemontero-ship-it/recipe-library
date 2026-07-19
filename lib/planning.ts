"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Recipe } from "@/lib/recipeModel";
import { getSupabaseClient } from "@/lib/supabase";

const TABLE = "recipe_planning_items";
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

type PlanningRow = {
  id: string;
  user_id: string;
  recipe_id: string;
  week_start: string;
  servings: number | string;
  include_in_shopping: boolean;
  created_at: string;
  updated_at: string;
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

function mapRow(row: PlanningRow): PlanningItem {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    weekStart: getWeekStart(row.week_start),
    servings: sanitizeServings(row.servings),
    includeInShopping: row.include_in_shopping !== false,
    addedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireSupabaseUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to use Planning across devices.");
  return { supabase, user: data.user };
}

function dispatchPlanningUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PLANNING_EVENT));
  }
}

function normalizeLegacyItem(value: unknown, fallbackWeek: string) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    recipeId?: unknown;
    weekStart?: unknown;
    servings?: unknown;
    includeInShopping?: unknown;
    addedAt?: unknown;
    updatedAt?: unknown;
  };
  if (typeof candidate.recipeId !== "string" || !candidate.recipeId) return null;
  const now = new Date().toISOString();
  return {
    recipeId: candidate.recipeId,
    weekStart: getWeekStart(
      typeof candidate.weekStart === "string" ? candidate.weekStart : fallbackWeek,
    ),
    servings: sanitizeServings(candidate.servings),
    includeInShopping: candidate.includeInShopping !== false,
    addedAt: typeof candidate.addedAt === "string" ? candidate.addedAt : now,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : now,
  };
}

async function migrateBrowserPlanningToSupabase() {
  if (typeof window === "undefined") return;
  const currentRaw = window.localStorage.getItem(STORAGE_KEY);
  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!currentRaw && !legacyRaw) return;

  const { supabase, user } = await requireSupabaseUser();
  const currentWeek = getWeekStart();
  const collected: ReturnType<typeof normalizeLegacyItem>[] = [];

  for (const [raw, fallbackWeek] of [
    [currentRaw, currentWeek],
    [legacyRaw, currentWeek],
  ] as const) {
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const value of parsed) collected.push(normalizeLegacyItem(value, fallbackWeek));
    } catch {
      // Keep browser data untouched if it cannot be parsed.
      return;
    }
  }

  const unique = new Map<string, NonNullable<(typeof collected)[number]>>();
  for (const item of collected) {
    if (!item) continue;
    unique.set(`${item.recipeId}:${item.weekStart}`, item);
  }

  if (unique.size) {
    const rows = Array.from(unique.values()).map((item) => ({
      user_id: user.id,
      recipe_id: item.recipeId,
      week_start: item.weekStart,
      servings: item.servings,
      include_in_shopping: item.includeInShopping,
      created_at: item.addedAt,
      updated_at: item.updatedAt,
    }));
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows, {
        onConflict: "user_id,recipe_id,week_start",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export async function getPlanning(): Promise<PlanningItem[]> {
  await migrateBrowserPlanningToSupabase();
  const { supabase, user } = await requireSupabaseUser();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,user_id,recipe_id,week_start,servings,include_in_shopping,created_at,updated_at")
    .eq("user_id", user.id)
    .order("week_start", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as PlanningRow[]).map(mapRow);
}

export async function addRecipesToPlanning(
  recipes: Recipe[],
  weekStart = getWeekStart(),
) {
  if (!recipes.length) return 0;
  await migrateBrowserPlanningToSupabase();
  const { supabase, user } = await requireSupabaseUser();
  const targetWeek = getWeekStart(weekStart);
  const rows = recipes.map((recipe) => ({
    user_id: user.id,
    recipe_id: recipe.id,
    week_start: targetWeek,
    servings: getRecipeDefaultServings(recipe),
    include_in_shopping: true,
  }));
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(rows, {
      onConflict: "user_id,recipe_id,week_start",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;
  dispatchPlanningUpdate();
  return data?.length ?? 0;
}

export async function updatePlanningItem(
  itemId: string,
  patch: Partial<
    Pick<PlanningItem, "servings" | "includeInShopping" | "weekStart">
  >,
) {
  const { supabase, user } = await requireSupabaseUser();
  const row: Record<string, unknown> = {};
  if (patch.servings !== undefined) row.servings = sanitizeServings(patch.servings);
  if (patch.includeInShopping !== undefined) {
    row.include_in_shopping = patch.includeInShopping;
  }
  if (patch.weekStart !== undefined) row.week_start = getWeekStart(patch.weekStart);
  if (!Object.keys(row).length) return;

  const { error } = await supabase
    .from(TABLE)
    .update(row)
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchPlanningUpdate();
}

export async function movePlanningItem(
  itemId: string,
  targetWeekStart: string,
  replaceDuplicate = false,
) {
  const { supabase, user } = await requireSupabaseUser();
  const { data: item, error: itemError } = await supabase
    .from(TABLE)
    .select("id,recipe_id,week_start")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) return { moved: false, duplicate: false };

  const weekStart = getWeekStart(targetWeekStart);
  const { data: duplicate, error: duplicateError } = await supabase
    .from(TABLE)
    .select("id")
    .eq("user_id", user.id)
    .eq("recipe_id", item.recipe_id)
    .eq("week_start", weekStart)
    .neq("id", itemId)
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate && !replaceDuplicate) return { moved: false, duplicate: true };

  if (duplicate) {
    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", duplicate.id)
      .eq("user_id", user.id);
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase
    .from(TABLE)
    .update({ week_start: weekStart })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchPlanningUpdate();
  return { moved: true, duplicate: Boolean(duplicate) };
}

export async function removePlanningItem(itemId: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchPlanningUpdate();
}

export async function clearPlanningWeek(weekStart: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", getWeekStart(weekStart));
  if (error) throw error;
  dispatchPlanningUpdate();
}

export function subscribeToPlanning(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;

  let active = true;
  let channel: RealtimeChannel | null = null;
  const supabase = getSupabaseClient();
  const handleLocal = () => callback();
  const handleFocus = () => callback();
  const handleVisibility = () => {
    if (document.visibilityState === "visible") callback();
  };

  window.addEventListener(PLANNING_EVENT, handleLocal);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  if (supabase) {
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`recipe-planning-${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: TABLE,
            filter: `user_id=eq.${data.user.id}`,
          },
          callback,
        )
        .subscribe();
    });
  }

  return () => {
    active = false;
    window.removeEventListener(PLANNING_EVENT, handleLocal);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (channel && supabase) void supabase.removeChannel(channel);
  };
}
