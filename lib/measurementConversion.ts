import { parseIngredientLine } from "@/lib/ingredientParser";
import type { RecipeIngredient } from "@/lib/recipeModel";

// Pure liquids poured from a measuring cup convert at a flat 240 ml/cup —
// unlike solids, this needs no per-ingredient density, since a cup is a fixed
// volume regardless of what water-like liquid fills it. Checked before the
// grams table below, so e.g. "chicken broth" resolves here, not there.
const LIQUID_KEYWORDS = [
  "chicken broth",
  "beef broth",
  "vegetable broth",
  "broth",
  "stock",
  "milk",
  "water",
  "wine",
  "juice",
  "vinegar",
  "buttermilk",
];
const CUP_TO_ML = 240;

// Grams per US cup for solid/semi-solid ingredients that actually show up as
// "cup" in this recipe library. Cup is a volume unit, so converting it to
// grams needs a density per ingredient — there is no generic factor. Matched
// by keyword against the ingredient name (longest keyword wins),
// case/accent-insensitive. Add entries here as new "cup" ingredients turn up
// in real recipes; anything unmatched is left in cups rather than guessed.
const CUP_GRAMS_ENTRIES: [string, number][] = [
  ["all-purpose flour", 120],
  ["plain flour", 120],
  ["flour", 120],
  ["granulated sugar", 200],
  ["caster sugar", 200],
  ["brown sugar", 220],
  ["powdered sugar", 120],
  ["icing sugar", 120],
  ["sugar", 200],
  ["butter", 227],
  ["olive oil", 216],
  ["vegetable oil", 218],
  ["oil", 218],
  ["yoghurt", 245],
  ["yogurt", 245],
  ["sour cream", 230],
  ["heavy cream", 238],
  ["honey", 340],
  ["peanut butter", 258],
  ["mayonnaise", 220],
  ["ketchup", 240],
  ["cottage cheese", 225],
  ["mozzarella", 112],
  ["parmesan", 100],
  ["cheddar", 113],
  ["feta", 150],
  ["shredded cheese", 113],
  ["grated cheese", 100],
  ["breadcrumbs", 108],
  ["panko", 50],
  ["rice", 185],
  ["quinoa", 170],
  ["oats", 90],
  ["lentils", 192],
  ["chickpeas", 164],
  ["black beans", 172],
  ["kidney beans", 177],
  ["corn", 165],
  ["walnuts", 120],
  ["almonds", 143],
  ["chocolate chips", 170],
  ["cocoa powder", 84],
  ["cornstarch", 128],
];

const CUP_GRAMS_BY_KEYWORD: [string, number][] = [...CUP_GRAMS_ENTRIES].sort(
  (a, b) => b[0].length - a[0].length,
);
const LIQUID_KEYWORDS_SORTED = [...LIQUID_KEYWORDS].sort((a, b) => b.length - a.length);

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function isLiquidName(name: string) {
  const normalized = normalizeName(name);
  return LIQUID_KEYWORDS_SORTED.some((keyword) => normalized.includes(keyword));
}

function gramsPerCupFor(name: string): number | null {
  const normalized = normalizeName(name);
  for (const [keyword, grams] of CUP_GRAMS_BY_KEYWORD) {
    if (normalized.includes(keyword)) return grams;
  }
  return null;
}

const OUNCE_TO_GRAMS = 28.3495;
const POUND_TO_GRAMS = 453.592;
const FLUID_OUNCE_TO_ML = 29.5735;

function baseGramsOrMl(value: number, unit: string, ingredientName: string): { base: number; smallUnit: "g" | "ml" } | null {
  switch (unit) {
    case "oz":
      return { base: value * OUNCE_TO_GRAMS, smallUnit: "g" };
    case "lb":
      return { base: value * POUND_TO_GRAMS, smallUnit: "g" };
    case "fl_oz":
      return { base: value * FLUID_OUNCE_TO_ML, smallUnit: "ml" };
    case "cup": {
      if (isLiquidName(ingredientName)) return { base: value * CUP_TO_ML, smallUnit: "ml" };
      const grams = gramsPerCupFor(ingredientName);
      return grams === null ? null : { base: value * grams, smallUnit: "g" };
    }
    default:
      return null;
  }
}

function roundTrim(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}

export function metricIngredientOverride(item: RecipeIngredient): { quantityUnitText: string } | null {
  if (!item.unit || item.quantity.min === null) return null;
  const name = item.canonicalIngredient || item.originalLine;

  const min = baseGramsOrMl(item.quantity.min, item.unit, name);
  if (!min) return null;
  const max = item.quantity.max !== null ? baseGramsOrMl(item.quantity.max, item.unit, name) : null;

  const referenceBase = max ? max.base : min.base;
  const useBigUnit = referenceBase >= 1000;
  const unit = useBigUnit ? (min.smallUnit === "g" ? "kg" : "l") : min.smallUnit;
  const divisor = useBigUnit ? 1000 : 1;
  const decimals = useBigUnit ? 2 : 0;

  const minDisplay = roundTrim(min.base / divisor, decimals);
  const quantityText =
    max && max.base !== min.base
      ? `${minDisplay}–${roundTrim(max.base / divisor, decimals)}`
      : `${minDisplay}`;

  return { quantityUnitText: `${quantityText} ${unit}` };
}

export function metricIngredientDisplayLine(item: RecipeIngredient): string {
  const override = metricIngredientOverride(item);
  if (!override) return "";
  return [override.quantityUnitText, item.canonicalIngredient, item.preparationNote]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// For plain-text ingredient lines (Shopping's draft/consolidated lines have
// already lost their structured RecipeIngredient by the time they reach the
// UI) — re-parses the line to recover quantity/unit/name, then converts it
// the same way as the recipe page. Returns "" when there's nothing to convert
// so callers can fall back to the original line.
export function metricLine(line: string): string {
  return metricIngredientDisplayLine(parseIngredientLine(line));
}
