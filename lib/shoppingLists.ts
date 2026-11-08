"use client";

import { getWeekStart } from "@/lib/planning";
import { getSupabaseClient } from "@/lib/supabase";

const LISTS_TABLE = "shopping_lists";
const ITEMS_TABLE = "shopping_list_items";
export const LISTS_EVENT = "recipe-library:shopping-lists-updated";

export type ListItem = {
  id: string;
  listId: string;
  text: string;
  checked: boolean;
  recipeTitles: string[];
};

export type ShoppingListSummary = {
  id: string;
  weekStart: string;
  createdAt: string;
  items: ListItem[];
};

type ListRow = {
  id: string;
  week_start: string;
  created_at: string;
};

type ItemRow = {
  id: string;
  list_id: string;
  text: string;
  checked: boolean;
  recipe_titles: string[] | null;
};

function mapItem(row: ItemRow): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    text: row.text,
    checked: Boolean(row.checked),
    recipeTitles: row.recipe_titles ?? [],
  };
}

async function requireSupabaseUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to use your lists.");
  return { supabase, user: data.user };
}

function dispatchListsUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LISTS_EVENT));
}

// Recipe titles are often pasted with emojis, arrows and ALL CAPS; strip that
// so a list name stays readable.
function tidyRecipeTitle(title: string) {
  let cleaned = title
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/[^\p{L}\p{N}\s'’&,.\-–()]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, "");
  if (cleaned && cleaned === cleaned.toUpperCase() && cleaned !== cleaned.toLowerCase()) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`);
  }
  return cleaned;
}

// Fixed date range (not "This week") so a saved list's name never changes meaning.
function formatListWeek(weekStart: string) {
  const [year, month, day] = getWeekStart(weekStart).split("-").map(Number);
  const start = new Date(year, month - 1, day, 12);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const monthName = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date);
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${end.getDate()} ${monthName(end)}`
      : `${start.getDate()} ${monthName(start)} – ${end.getDate()} ${monthName(end)}`;
  return end.getFullYear() === new Date().getFullYear() ? range : `${range} ${end.getFullYear()}`;
}

// A list is named after every recipe it includes plus the dates of its week.
export function shoppingListName(list: Pick<ShoppingListSummary, "weekStart" | "items">) {
  const titles: string[] = [];
  for (const item of list.items) {
    for (const raw of item.recipeTitles) {
      const title = tidyRecipeTitle(raw);
      if (title && !titles.includes(title)) titles.push(title);
    }
  }
  const week = formatListWeek(list.weekStart);
  if (!titles.length) return `Own items · ${week}`;
  return `${titles.join(", ")} · ${week}`;
}

export async function getShoppingLists(): Promise<ShoppingListSummary[]> {
  const { supabase, user } = await requireSupabaseUser();
  const { data: lists, error } = await supabase
    .from(LISTS_TABLE)
    .select("id,week_start,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!lists?.length) return [];

  const { data: items, error: itemsError } = await supabase
    .from(ITEMS_TABLE)
    .select("id,list_id,text,checked,recipe_titles")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (itemsError) throw itemsError;

  const byList = new Map<string, ListItem[]>();
  for (const row of (items ?? []) as ItemRow[]) {
    const mapped = mapItem(row);
    byList.set(mapped.listId, [...(byList.get(mapped.listId) ?? []), mapped]);
  }

  return (lists as ListRow[]).map((row) => ({
    id: row.id,
    weekStart: getWeekStart(row.week_start),
    createdAt: row.created_at,
    items: byList.get(row.id) ?? [],
  }));
}

export async function getShoppingList(listId: string): Promise<ShoppingListSummary | null> {
  const lists = await getShoppingLists();
  return lists.find((list) => list.id === listId) ?? null;
}

export async function createShoppingList(
  weekStart: string,
  items: Array<{ text: string; checked?: boolean; recipeTitles?: string[] }> = [],
) {
  const { supabase, user } = await requireSupabaseUser();
  const { data, error } = await supabase
    .from(LISTS_TABLE)
    .insert({ user_id: user.id, week_start: getWeekStart(weekStart) })
    .select("id")
    .single();
  if (error) throw error;

  const listId = data.id as string;
  const rows = items
    .filter((item) => item.text.trim())
    .map((item, position) => ({
      list_id: listId,
      user_id: user.id,
      text: item.text.trim(),
      checked: Boolean(item.checked),
      recipe_titles: item.recipeTitles ?? [],
      position,
    }));
  if (rows.length) {
    const { error: itemsError } = await supabase.from(ITEMS_TABLE).insert(rows);
    if (itemsError) throw itemsError;
  }
  dispatchListsUpdate();
  return listId;
}

export async function deleteShoppingList(listId: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(LISTS_TABLE)
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchListsUpdate();
}

export async function addListItems(
  listId: string,
  items: Array<{ text: string; recipeTitles?: string[] }>,
) {
  const clean = items.filter((item) => item.text.trim());
  if (!clean.length) return;
  const { supabase, user } = await requireSupabaseUser();
  const { count, error: countError } = await supabase
    .from(ITEMS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId)
    .eq("user_id", user.id);
  if (countError) throw countError;

  const start = count ?? 0;
  const { error } = await supabase.from(ITEMS_TABLE).insert(
    clean.map((item, index) => ({
      list_id: listId,
      user_id: user.id,
      text: item.text.trim(),
      checked: false,
      recipe_titles: item.recipeTitles ?? [],
      position: start + index,
    })),
  );
  if (error) throw error;
  dispatchListsUpdate();
}

export async function updateListItem(
  itemId: string,
  patch: Partial<Pick<ListItem, "text" | "checked">>,
) {
  const { supabase, user } = await requireSupabaseUser();
  const row: Record<string, unknown> = {};
  if (patch.text !== undefined) row.text = patch.text.trim();
  if (patch.checked !== undefined) row.checked = patch.checked;
  const { error } = await supabase
    .from(ITEMS_TABLE)
    .update(row)
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchListsUpdate();
}

export async function setAllListItemsChecked(listId: string, checked: boolean) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(ITEMS_TABLE)
    .update({ checked })
    .eq("list_id", listId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchListsUpdate();
}

export async function removeListItem(itemId: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(ITEMS_TABLE)
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) throw error;
  dispatchListsUpdate();
}

export function subscribeToLists(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleVisibility = () => {
    if (document.visibilityState === "visible") callback();
  };
  window.addEventListener(LISTS_EVENT, callback);
  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    window.removeEventListener(LISTS_EVENT, callback);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
