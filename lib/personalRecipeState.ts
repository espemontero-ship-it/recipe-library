"use client";

import { Recipe, RecipePersonal } from "@/lib/recipeModel";
import { getSupabaseClient } from "@/lib/supabase";

const LEGACY_STORAGE_KEY = "recipe-library:personal-state:v1";
const LEGACY_MIGRATED_KEY = "recipe-library:personal-state:v1:migrated";
const RECIPE_TABLE = "recipes_clean_v14_final";
const PRIVATE_STATE_TABLE = "recipe_private_state";
export const PERSONAL_STATE_EVENT = "recipe-library:personal-state-updated";

type StoredPersonalState = {
  favorite?: boolean;
  tested?: boolean;
  thisWeekend?: boolean;
  rating?: number | null;
  privateNotes?: string | null;
};

type PersonalStateMap = Record<string, StoredPersonalState>;

type PersonalPatch = Partial<
  Pick<
    RecipePersonal,
    "favorite" | "tested" | "thisWeekend" | "rating" | "privateNotes"
  >
>;

function deriveStatus(
  personal: Pick<RecipePersonal, "favorite" | "tested" | "thisWeekend">,
): RecipePersonal["status"] {
  if (personal.favorite) return "favorite";
  if (personal.thisWeekend) return "this_weekend";
  if (personal.tested) return "tested";
  return "to_try";
}

function applyPatch(recipe: Recipe, patch: PersonalPatch): Recipe {
  const personal = { ...recipe.personal, ...patch };
  personal.status = deriveStatus(personal);
  return {
    ...recipe,
    personal,
    updatedAt: new Date().toISOString(),
  };
}

function emitPersonalStateUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PERSONAL_STATE_EVENT));
  }
}

function readLegacyStateMap(): PersonalStateMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as PersonalStateMap)
      : {};
  } catch {
    return {};
  }
}

export function mergePersonalState(recipe: Recipe): Recipe {
  return recipe;
}

export async function loadPrivateRecipeNotes(recipeId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data, error } = await supabase
    .from(PRIVATE_STATE_TABLE)
    .select("private_notes")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.private_notes === "string" ? data.private_notes : null;
}

export async function savePersonalState(
  recipe: Recipe,
  patch: PersonalPatch,
): Promise<Recipe> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase environment variables are missing.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Sign in as the library administrator first.");

  const publicPatch: Record<string, boolean | number | null | string> = {};
  if (patch.favorite !== undefined) publicPatch.favorite = patch.favorite;
  if (patch.tested !== undefined) publicPatch.tested = patch.tested;
  if (patch.thisWeekend !== undefined) {
    publicPatch.this_weekend = patch.thisWeekend;
  }
  if (patch.rating !== undefined) publicPatch.rating = patch.rating;

  if (Object.keys(publicPatch).length) {
    publicPatch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from(RECIPE_TABLE)
      .update(publicPatch)
      .eq("id", recipe.id);
    if (error) throw error;
  }

  if (patch.privateNotes !== undefined) {
    const { error } = await supabase.from(PRIVATE_STATE_TABLE).upsert(
      {
        user_id: authData.user.id,
        recipe_id: recipe.id,
        private_notes: patch.privateNotes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,recipe_id" },
    );
    if (error) throw error;
  }

  const updated = applyPatch(recipe, patch);
  emitPersonalStateUpdate();
  return updated;
}

export async function migrateLegacyPersonalStateToSupabase() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(LEGACY_MIGRATED_KEY) === "true") return;

  const state = readLegacyStateMap();
  const entries = Object.entries(state);
  if (!entries.length) {
    window.localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return;

  for (const [recipeId, stored] of entries) {
    const publicPatch: Record<string, boolean | number | null | string> = {
      updated_at: new Date().toISOString(),
    };

    if (stored.favorite !== undefined) publicPatch.favorite = stored.favorite;
    if (stored.tested !== undefined) publicPatch.tested = stored.tested;
    if (stored.thisWeekend !== undefined) {
      publicPatch.this_weekend = stored.thisWeekend;
    }
    if (stored.rating !== undefined) publicPatch.rating = stored.rating;

    if (Object.keys(publicPatch).length > 1) {
      const { error } = await supabase
        .from(RECIPE_TABLE)
        .update(publicPatch)
        .eq("id", recipeId);
      if (error) throw error;
    }

    if (stored.privateNotes !== undefined) {
      const { error } = await supabase.from(PRIVATE_STATE_TABLE).upsert(
        {
          user_id: authData.user.id,
          recipe_id: recipeId,
          private_notes: stored.privateNotes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,recipe_id" },
      );
      if (error) throw error;
    }
  }

  window.localStorage.setItem(LEGACY_MIGRATED_KEY, "true");
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  emitPersonalStateUpdate();
}

export function subscribeToPersonalState(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(PERSONAL_STATE_EVENT, callback);
  return () => window.removeEventListener(PERSONAL_STATE_EVENT, callback);
}
