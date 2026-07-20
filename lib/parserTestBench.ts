import recipeFixturesJson from "@/tests/parser/recipe-fixtures.json";
import ingredientFixturesJson from "@/tests/parser/ingredient-fixtures.json";
import { parseIngredientLine } from "@/lib/ingredientParser";
import { parseRecipe, PasteContext } from "@/lib/recipePasteParser";

export type FixtureDiff = {
  field: string;
  expected: unknown;
  actual: unknown;
};

export type RecipeFixture = {
  id: string;
  name: string;
  source: string;
  raw: string;
  context?: PasteContext;
  expected: Record<string, unknown>;
};

export type IngredientFixture = {
  id: string;
  input: string;
  expected: {
    quantityMin: number | null;
    quantityMax: number | null;
    unit: string | null;
    canonicalIngredient: string | null;
    preparationNote: string | null;
  };
};

export type FixtureResult<TFixture> = {
  fixture: TFixture;
  passed: boolean;
  diffs: FixtureDiff[];
  actual: Record<string, unknown>;
};

const recipeFixtures = recipeFixturesJson as RecipeFixture[];
const ingredientFixtures = ingredientFixturesJson as IngredientFixture[];

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareFields(expected: Record<string, unknown>, actual: Record<string, unknown>) {
  const diffs: FixtureDiff[] = [];
  for (const [field, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[field];
    if (!sameValue(expectedValue, actualValue)) {
      diffs.push({ field, expected: expectedValue, actual: actualValue });
    }
  }
  return diffs;
}

export function runRecipeFixture(fixture: RecipeFixture): FixtureResult<RecipeFixture> {
  const parsed = parseRecipe(fixture.raw, fixture.context ?? {});
  const actual: Record<string, unknown> = {
    ...parsed,
    methodBodies: parsed.method.map((step) => step.body),
  };
  const diffs = compareFields(fixture.expected, actual);
  return { fixture, passed: diffs.length === 0, diffs, actual };
}

export function runIngredientFixture(
  fixture: IngredientFixture,
): FixtureResult<IngredientFixture> {
  const parsed = parseIngredientLine(fixture.input);
  const actual: Record<string, unknown> = {
    quantityMin: parsed.quantity.min,
    quantityMax: parsed.quantity.max,
    unit: parsed.unit,
    canonicalIngredient: parsed.canonicalIngredient,
    preparationNote: parsed.preparationNote,
  };
  const diffs = compareFields(fixture.expected, actual);
  return { fixture, passed: diffs.length === 0, diffs, actual };
}

export function runParserTestBench() {
  const recipes = recipeFixtures.map(runRecipeFixture);
  const ingredients = ingredientFixtures.map(runIngredientFixture);
  const all = [...recipes, ...ingredients];

  return {
    recipes,
    ingredients,
    summary: {
      total: all.length,
      passed: all.filter((result) => result.passed).length,
      failed: all.filter((result) => !result.passed).length,
      recipeTotal: recipes.length,
      recipePassed: recipes.filter((result) => result.passed).length,
      ingredientTotal: ingredients.length,
      ingredientPassed: ingredients.filter((result) => result.passed).length,
    },
  };
}
