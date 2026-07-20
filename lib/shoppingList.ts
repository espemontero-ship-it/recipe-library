"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Recipe } from "@/lib/recipeModel";
import type { PlanningItem } from "@/lib/planning";
import { ingredientDisplayLine } from "@/lib/ingredientParser";
import { getPlanning, getRecipeDefaultServings, getWeekStart } from "@/lib/planning";
import { getSupabaseClient } from "@/lib/supabase";

const TABLE = "recipe_shopping_items";
const STORAGE_KEY = "recipe-library:shopping:v1";
export const SHOPPING_EVENT = "recipe-library:shopping-updated";

export type ShoppingSource = {
  recipeId: string;
  recipeTitle: string;
  planItemId: string;
  ingredientId: string;
};

export type ShoppingItem = {
  id: string;
  weekStart: string;
  text: string;
  checked: boolean;
  manual: boolean;
  sources: ShoppingSource[];
  createdAt: string;
  updatedAt: string;
};

export type ShoppingWeek = {
  weekStart: string;
  items: ShoppingItem[];
  updatedAt: string;
};

export const SHOPPING_CATEGORIES = [
  "Fruit & vegetables",
  "Meat & fish",
  "Dairy & eggs",
  "Bakery",
  "Pasta, rice & cereals",
  "Pantry & preserves",
  "Sauces & condiments",
  "Spices",
  "Frozen",
  "Other",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export type ShoppingDraftItem = {
  id: string;
  weekStart: string;
  recipeId: string;
  recipeTitle: string;
  planItemId: string;
  ingredientId: string;
  sectionTitle: string | null;
  originalLine: string;
  scaledLine: string;
  selected: boolean;
};


type ParsedIngredient = {
  quantity: number | null;
  unit: string | null;
  ingredient: string;
  displayIngredient: string;
};

const FRACTION_VALUES: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 1 / 10,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

const NUMBER_PATTERN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])?|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])`;
const STARTING_QUANTITY = new RegExp(
  String.raw`^(\s*(?:(?:about|approx\.?|approximately|around)\s+)?)(` +
    NUMBER_PATTERN +
    String.raw`)(\s*(?:-|–|—|to)\s*(` +
    NUMBER_PATTERN +
    String.raw`))?`,
  "i",
);

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  bunch: "bunch",
  bunches: "bunch",
  packet: "packet",
  packets: "packet",
  pack: "packet",
  packs: "packet",
  piece: "piece",
  pieces: "piece",
  slice: "slice",
  slices: "slice",
};

const DISPLAY_UNITS: Record<string, { singular: string; plural: string }> = {
  g: { singular: "g", plural: "g" },
  kg: { singular: "kg", plural: "kg" },
  ml: { singular: "ml", plural: "ml" },
  l: { singular: "l", plural: "l" },
  tsp: { singular: "tsp", plural: "tsp" },
  tbsp: { singular: "tbsp", plural: "tbsp" },
  cup: { singular: "cup", plural: "cups" },
  oz: { singular: "oz", plural: "oz" },
  lb: { singular: "lb", plural: "lb" },
  clove: { singular: "clove", plural: "cloves" },
  can: { singular: "can", plural: "cans" },
  bunch: { singular: "bunch", plural: "bunches" },
  packet: { singular: "packet", plural: "packets" },
  piece: { singular: "piece", plural: "pieces" },
  slice: { singular: "slice", plural: "slices" },
  count: { singular: "", plural: "" },
};


function parseFraction(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;

  const unicode = Object.entries(FRACTION_VALUES).find(([symbol]) =>
    trimmed.includes(symbol),
  );
  if (unicode) {
    const whole = Number.parseFloat(trimmed.replace(unicode[0], "")) || 0;
    return whole + unicode[1];
  }

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const [numerator, denominator] = fraction.split("/").map(Number);
    if (denominator) return Number(whole) + numerator / denominator;
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [numerator, denominator] = trimmed.split("/").map(Number);
    if (denominator) return numerator / denominator;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  const whole = Math.floor(rounded + 1e-9);
  const fraction = rounded - whole;
  const commonFractions: Array<[number, string]> = [
    [1 / 8, "⅛"],
    [1 / 6, "⅙"],
    [1 / 5, "⅕"],
    [1 / 4, "¼"],
    [1 / 3, "⅓"],
    [3 / 8, "⅜"],
    [2 / 5, "⅖"],
    [1 / 2, "½"],
    [3 / 5, "⅗"],
    [5 / 8, "⅝"],
    [2 / 3, "⅔"],
    [3 / 4, "¾"],
    [4 / 5, "⅘"],
    [5 / 6, "⅚"],
    [7 / 8, "⅞"],
  ];
  const close = commonFractions.find(([numeric]) =>
    Math.abs(fraction - numeric) < 0.025,
  );

  if (close) return `${whole || ""}${close[1]}`;
  if (Math.abs(fraction) < 0.025) return String(whole);
  return rounded.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export function scaleIngredientLine(line: string, factor: number) {
  if (!line.trim() || Math.abs(factor - 1) < 0.0001) return line.trim();
  const match = STARTING_QUANTITY.exec(line);
  if (!match) return line.trim();

  const first = parseFraction(match[2]);
  const second = match[4] ? parseFraction(match[4]) : null;
  if (first === null) return line.trim();

  const prefix = match[1] ?? "";
  const separator = match[3]?.replace(match[4] ?? "", "") ?? "";
  const scaledFirst = formatNumber(first * factor);
  const scaledSecond = second === null ? "" : formatNumber(second * factor);
  const replacement = `${prefix}${scaledFirst}${second === null ? "" : `${separator}${scaledSecond}`}`;
  return `${replacement}${line.slice(match[0].length)}`.trim();
}

function normalizeIngredientName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_RULES: Array<{
  category: ShoppingCategory;
  terms: string[];
}> = [
  {
    category: "Frozen",
    terms: ["frozen", "congelado", "congelada"],
  },
  {
    category: "Spices",
    terms: [
      "salt", "sal", "black pepper", "white pepper", "pimienta",
      "paprika", "pimenton", "cayenne", "cayena", "oregano", "orégano",
      "cumin", "comino", "cinnamon", "canela", "turmeric", "curcuma",
      "curry", "tajin", "tajín", "chilli powder", "chili powder",
      "garlic powder", "onion powder", "seasoning", "spice", "especia",
      "gochugaru", "nutmeg", "nuez moscada", "bay leaf", "laurel",
    ],
  },
  {
    category: "Sauces & condiments",
    terms: [
      "soy sauce", "salsa de soja", "mayonnaise", "mayonesa", "mayo",
      "mustard", "mostaza", "vinegar", "vinagre", "olive oil", "oil",
      "aceite", "hoisin", "gochujang", "sriracha", "ketchup", "pesto",
      "hot sauce", "fish sauce", "salsa", "dressing", "aderezo",
      "tomato paste", "miso", "tahini",
    ],
  },
  {
    category: "Meat & fish",
    terms: [
      "chicken", "pollo", "beef", "ternera", "vacuno", "pork", "cerdo",
      "lamb", "cordero", "turkey", "pavo", "ham", "jamon", "jamón",
      "bacon", "sausage", "salchicha", "salmon", "salmón", "tuna",
      "atun", "atún", "shrimp", "prawn", "gamba", "langostino", "fish",
      "pescado", "cod", "bacalao", "anchovy", "anchoa", "mussels",
      "mejillones", "squid", "calamar",
    ],
  },
  {
    category: "Dairy & eggs",
    terms: [
      "milk", "leche", "cream", "nata", "yogurt", "yoghurt", "yogur",
      "cheese", "queso", "mozzarella", "parmesan", "parmesano", "feta",
      "cottage", "ricotta", "butter", "mantequilla", "egg", "huevo",
      "creme fraiche", "crème fraîche",
    ],
  },
  {
    category: "Bakery",
    terms: [
      "bread", "pan", "baguette", "bun", "roll", "tortilla", "wrap",
      "pita", "naan", "croissant",
    ],
  },
  {
    category: "Pasta, rice & cereals",
    terms: [
      "pasta", "spaghetti", "macaroni", "macarron", "macarrón", "noodle",
      "fideo", "rice", "arroz", "couscous", "cuscus", "cuscús", "quinoa",
      "oats", "avena", "barley", "cebada", "bulgur", "polenta",
    ],
  },
  {
    category: "Fruit & vegetables",
    terms: [
      "onion", "cebolla", "garlic", "ajo", "tomato", "tomate", "pepper",
      "pimiento", "chilli", "chili", "guindilla", "lime", "lima", "lemon",
      "limon", "limón", "orange", "naranja", "apple", "manzana", "pear",
      "pera", "berry", "berries", "frambues*", "arand*", "strawber*", "fresa",
      "mango", "pineapple", "piña", "spinach", "espinaca", "lettuce",
      "lechuga", "cabbage", "col", "eggplant", "aubergine", "berenjena",
      "potato", "patata", "sweet potato", "boniato", "carrot", "zanahoria",
      "cucumber", "pepino", "mushroom", "champi*", "scallion", "spring onion",
      "cebolleta", "parsley", "perejil", "cilantro", "coriander", "albahaca",
      "basil", "mint", "menta", "avocado", "aguacate", "celery", "apio",
      "broccoli", "brocoli", "brócoli", "cauliflower", "coliflor", "zucchini",
      "courgette", "calabacin", "calabacín", "pumpkin", "calabaza",
    ],
  },
  {
    category: "Pantry & preserves",
    terms: [
      "flour", "harina", "sugar", "azucar", "azúcar", "baking powder",
      "levadura", "bean", "judia", "judía", "chickpea", "garbanzo", "lentil",
      "lenteja", "corn", "maiz", "maíz", "pea", "guisante", "stock",
      "broth", "caldo", "coconut milk", "leche de coco", "nut", "nuez",
      "almond", "almendra", "pistach*", "seed", "semilla", "canned", "tinned",
      "lata", "chocolate", "cocoa", "cacao", "honey", "miel", "maple syrup",
    ],
  },
];

function categoryTermMatches(text: string, rawTerm: string) {
  const normalizedText = normalizeIngredientName(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const stem = rawTerm.endsWith("*");
  const normalizedTerm = normalizeIngredientName(
    stem ? rawTerm.slice(0, -1) : rawTerm,
  );
  if (!normalizedTerm) return false;

  const textTokens = normalizedText.split(/\s+/).filter(Boolean);
  const termTokens = normalizedTerm.split(/\s+/).filter(Boolean);
  if (termTokens.length > 1) {
    return ` ${normalizedText} `.includes(` ${normalizedTerm} `);
  }

  const term = termTokens[0];
  return textTokens.some((token) => {
    if (stem) return token.startsWith(term);
    return (
      token === term ||
      token === `${term}s` ||
      token === `${term}es` ||
      (term.endsWith("y") && token === `${term.slice(0, -1)}ies`)
    );
  });
}

export function getShoppingCategory(text: string): ShoppingCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => categoryTermMatches(text, term))) {
      return rule.category;
    }
  }
  return "Other";
}

function parseIngredientLine(line: string): ParsedIngredient {
  const quantityMatch = STARTING_QUANTITY.exec(line);
  if (!quantityMatch) {
    return {
      quantity: null,
      unit: null,
      ingredient: normalizeIngredientName(line),
      displayIngredient: line.trim(),
    };
  }

  if (quantityMatch[4]) {
    return {
      quantity: null,
      unit: null,
      ingredient: normalizeIngredientName(line),
      displayIngredient: line.trim(),
    };
  }

  const quantity = parseFraction(quantityMatch[2]);
  const rest = line.slice(quantityMatch[0].length).trim();
  const unitMatch = /^([A-Za-z]+)\b\.?\s*/.exec(rest);
  const rawUnit = unitMatch?.[1]?.toLowerCase() ?? "";
  const recognizedUnit = UNIT_ALIASES[rawUnit] ?? null;
  const unit = recognizedUnit ?? "count";
  const displayIngredient = unitMatch && recognizedUnit
    ? rest.slice(unitMatch[0].length).trim()
    : rest;

  return {
    quantity,
    unit,
    ingredient: normalizeIngredientName(displayIngredient),
    displayIngredient,
  };
}

function convertQuantity(quantity: number, unit: string | null) {
  if (unit === "kg") return { quantity: quantity * 1000, unit: "g" };
  if (unit === "l") return { quantity: quantity * 1000, unit: "ml" };
  return { quantity, unit };
}

function displayUnit(unit: string, quantity: number) {
  const labels = DISPLAY_UNITS[unit];
  if (!labels) return unit;
  return Math.abs(quantity - 1) < 0.0001 ? labels.singular : labels.plural;
}

function createShoppingId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildShoppingDraft(
  recipes: Recipe[],
  plan: PlanningItem[],
  weekStart: string,
): ShoppingDraftItem[] {
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const draft: ShoppingDraftItem[] = [];

  for (const planningItem of plan) {
    if (
      planningItem.weekStart !== weekStart ||
      !planningItem.includeInShopping
    ) {
      continue;
    }

    const recipe = recipeMap.get(planningItem.recipeId);
    if (!recipe) continue;
    const originalServings = getRecipeDefaultServings(recipe);
    const factor = originalServings > 0 ? planningItem.servings / originalServings : 1;

    for (const section of recipe.ingredientSections) {
      for (const ingredient of section.items) {
        draft.push({
          id: `${planningItem.id}:${ingredient.id}`,
          weekStart,
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          planItemId: planningItem.id,
          ingredientId: ingredient.id,
          sectionTitle: section.title,
          originalLine: ingredientDisplayLine(ingredient) || ingredient.originalLine,
          scaledLine: scaleIngredientLine(ingredientDisplayLine(ingredient) || ingredient.originalLine, factor),
          selected: true,
        });
      }
    }
  }

  return draft;
}

export function consolidateDraft(
  weekStart: string,
  items: ShoppingDraftItem[],
): ShoppingItem[] {
  const selected = items.filter((item) => item.selected);
  const groups = new Map<
    string,
    {
      quantity: number;
      unit: string;
      ingredient: string;
      displayIngredient: string;
      sources: ShoppingSource[];
    }
  >();
  const standalone: ShoppingItem[] = [];
  const now = new Date().toISOString();

  for (const item of selected) {
    const parsed = parseIngredientLine(item.scaledLine);
    const source: ShoppingSource = {
      recipeId: item.recipeId,
      recipeTitle: item.recipeTitle,
      planItemId: item.planItemId,
      ingredientId: item.ingredientId,
    };

    if (parsed.quantity !== null && parsed.unit && parsed.ingredient) {
      const converted = convertQuantity(parsed.quantity, parsed.unit);
      const key = `${converted.unit}:${parsed.ingredient}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += converted.quantity;
        existing.sources.push(source);
      } else {
        groups.set(key, {
          quantity: converted.quantity,
          unit: converted.unit ?? parsed.unit,
          ingredient: parsed.ingredient,
          displayIngredient: parsed.displayIngredient,
          sources: [source],
        });
      }
      continue;
    }

    standalone.push({
      id: createShoppingId(),
      weekStart,
      text: item.scaledLine,
      checked: false,
      manual: false,
      sources: [source],
      createdAt: now,
      updatedAt: now,
    });
  }

  const merged = Array.from(groups.values()).map((group) => ({
    id: createShoppingId(),
    weekStart,
    text: `${formatNumber(group.quantity)} ${displayUnit(group.unit, group.quantity)} ${group.displayIngredient}`.trim(),
    checked: false,
    manual: false,
    sources: group.sources,
    createdAt: now,
    updatedAt: now,
  }));

  return [...merged, ...standalone].sort((a, b) =>
    a.text.localeCompare(b.text, "en", { sensitivity: "base" }),
  );
}

function sourceKey(source: ShoppingSource) {
  return `${source.planItemId}:${source.ingredientId}`;
}

function itemIdentity(item: ShoppingItem) {
  const parsed = parseIngredientLine(item.text);
  if (parsed.ingredient) return `${parsed.unit ?? "line"}:${parsed.ingredient}`;
  return normalizeIngredientName(item.text);
}

export async function regenerateShoppingWeekIfExists(
  recipes: Recipe[],
  weekStart: string,
): Promise<ShoppingWeek | null> {
  const normalized = getWeekStart(weekStart);
  const existing = await getShoppingWeek(normalized);
  if (!existing) return null;

  const plan = await getPlanning();
  const draft = buildShoppingDraft(recipes, plan, normalized);
  const automaticExisting = existing.items.filter((item) => !item.manual);
  const manualItems = existing.items.filter((item) => item.manual);

  const existingSourceKeys = new Set(
    automaticExisting.flatMap((item) => item.sources.map(sourceKey)),
  );
  const existingPlanIds = new Set(
    automaticExisting.flatMap((item) => item.sources.map((source) => source.planItemId)),
  );
  const currentPlanIds = new Set(draft.map((item) => item.planItemId));
  const newPlanIds = new Set(
    Array.from(currentPlanIds).filter((planItemId) => !existingPlanIds.has(planItemId)),
  );

  const regenerated = consolidateDraft(
    normalized,
    draft.map((item) => ({
      ...item,
      selected:
        newPlanIds.has(item.planItemId) ||
        existingSourceKeys.has(`${item.planItemId}:${item.ingredientId}`),
    })),
  );

  const checkedSourceKeys = new Set(
    automaticExisting
      .filter((item) => item.checked)
      .flatMap((item) => item.sources.map(sourceKey)),
  );
  const checkedIdentities = new Set(
    automaticExisting.filter((item) => item.checked).map(itemIdentity),
  );

  const withPreservedChecks = regenerated.map((item) => ({
    ...item,
    checked:
      item.sources.some((source) => checkedSourceKeys.has(sourceKey(source))) ||
      checkedIdentities.has(itemIdentity(item)),
  }));

  return saveShoppingWeek(normalized, [...withPreservedChecks, ...manualItems]);
}


type ShoppingRow = {
  id: string;
  user_id: string;
  week_start: string;
  text: string;
  checked: boolean;
  manual: boolean;
  sources: unknown;
  position: number;
  created_at: string;
  updated_at: string;
};

function asSources(value: unknown): ShoppingSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((source): source is ShoppingSource => {
    if (!source || typeof source !== "object") return false;
    const item = source as Partial<ShoppingSource>;
    return Boolean(
      typeof item.recipeId === "string" &&
        typeof item.recipeTitle === "string" &&
        typeof item.planItemId === "string" &&
        typeof item.ingredientId === "string",
    );
  });
}

function mapShoppingRow(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    weekStart: getWeekStart(row.week_start),
    text: row.text,
    checked: Boolean(row.checked),
    manual: Boolean(row.manual),
    sources: asSources(row.sources),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireSupabaseUser() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase environment variables are missing.");
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in to use the shopping list across devices.");
  return { supabase, user: data.user };
}

function dispatchShoppingUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SHOPPING_EVENT));
  }
}

async function migrateBrowserShoppingToSupabase() {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object") return;

  const { supabase, user } = await requireSupabaseUser();
  const store = parsed as Record<string, ShoppingWeek>;
  const weekStarts = Object.keys(store).map(getWeekStart);
  const existingWeeks = new Set<string>();

  if (weekStarts.length) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("week_start")
      .eq("user_id", user.id)
      .in("week_start", weekStarts);
    if (error) throw error;
    for (const row of data ?? []) existingWeeks.add(getWeekStart(row.week_start));
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const [rawWeek, week] of Object.entries(store)) {
    const weekStart = getWeekStart(rawWeek);
    if (existingWeeks.has(weekStart) || !Array.isArray(week?.items)) continue;
    week.items.forEach((item, position) => {
      if (!item || typeof item.text !== "string" || !item.text.trim()) return;
      rows.push({
        user_id: user.id,
        week_start: weekStart,
        text: item.text.trim(),
        checked: Boolean(item.checked),
        manual: Boolean(item.manual),
        sources: Array.isArray(item.sources) ? item.sources : [],
        position,
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || new Date().toISOString(),
      });
    });
  }

  if (rows.length) {
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) throw error;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function getShoppingWeek(weekStart: string): Promise<ShoppingWeek | null> {
  await migrateBrowserShoppingToSupabase();
  const { supabase, user } = await requireSupabaseUser();
  const normalized = getWeekStart(weekStart);
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,user_id,week_start,text,checked,manual,sources,position,created_at,updated_at")
    .eq("user_id", user.id)
    .eq("week_start", normalized)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return null;
  const items = (data as ShoppingRow[]).map(mapShoppingRow);
  return {
    weekStart: normalized,
    items,
    updatedAt: items.reduce(
      (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
      items[0].updatedAt,
    ),
  };
}

export async function saveShoppingWeek(weekStart: string, items: ShoppingItem[]) {
  const { supabase, user } = await requireSupabaseUser();
  const normalized = getWeekStart(weekStart);
  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", normalized);
  if (deleteError) throw deleteError;

  if (items.length) {
    const rows = items.map((item, position) => ({
      user_id: user.id,
      week_start: normalized,
      text: item.text.trim(),
      checked: item.checked,
      manual: item.manual,
      sources: item.sources,
      position,
    }));
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) throw error;
  }
  dispatchShoppingUpdate();
  return getShoppingWeek(normalized);
}

export async function updateShoppingItem(
  weekStart: string,
  itemId: string,
  patch: Partial<Pick<ShoppingItem, "text" | "checked">>,
) {
  const { supabase, user } = await requireSupabaseUser();
  const row: Record<string, unknown> = {};
  if (patch.text !== undefined) row.text = patch.text.trim();
  if (patch.checked !== undefined) row.checked = patch.checked;
  const { error } = await supabase
    .from(TABLE)
    .update(row)
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("week_start", getWeekStart(weekStart));
  if (error) throw error;
  dispatchShoppingUpdate();
}

export async function addManualShoppingItem(weekStart: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  const { supabase, user } = await requireSupabaseUser();
  const normalized = getWeekStart(weekStart);
  const { count, error: countError } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("week_start", normalized);
  if (countError) throw countError;
  const { error } = await supabase.from(TABLE).insert({
    user_id: user.id,
    week_start: normalized,
    text: clean,
    checked: false,
    manual: true,
    sources: [],
    position: count ?? 0,
  });
  if (error) throw error;
  dispatchShoppingUpdate();
}

export async function removeShoppingItem(weekStart: string, itemId: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id)
    .eq("week_start", getWeekStart(weekStart));
  if (error) throw error;
  dispatchShoppingUpdate();
}

export async function removeCheckedShoppingItems(weekStart: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", getWeekStart(weekStart))
    .eq("checked", true);
  if (error) throw error;
  dispatchShoppingUpdate();
}

export async function clearShoppingWeek(weekStart: string) {
  const { supabase, user } = await requireSupabaseUser();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", getWeekStart(weekStart));
  if (error) throw error;
  dispatchShoppingUpdate();
}

export function subscribeToShopping(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  let active = true;
  let channel: RealtimeChannel | null = null;
  const supabase = getSupabaseClient();
  const handleLocal = () => callback();
  const handleFocus = () => callback();
  const handleVisibility = () => {
    if (document.visibilityState === "visible") callback();
  };

  window.addEventListener(SHOPPING_EVENT, handleLocal);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);

  if (supabase) {
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`recipe-shopping-${data.user.id}`)
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
    window.removeEventListener(SHOPPING_EVENT, handleLocal);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    if (channel && supabase) void supabase.removeChannel(channel);
  };
}

export function shoppingListText(items: ShoppingItem[]) {
  const remaining = items.filter((item) => !item.checked);
  const groups = new Map<ShoppingCategory, ShoppingItem[]>();
  for (const category of SHOPPING_CATEGORIES) groups.set(category, []);
  for (const item of remaining) {
    groups.get(getShoppingCategory(item.text))?.push(item);
  }

  return SHOPPING_CATEGORIES.flatMap((category) => {
    const categoryItems = groups.get(category) ?? [];
    if (!categoryItems.length) return [];
    return [
      category.toUpperCase(),
      ...categoryItems.map((item) => `☐ ${item.text}`),
      "",
    ];
  })
    .join("\n")
    .trim();
}

