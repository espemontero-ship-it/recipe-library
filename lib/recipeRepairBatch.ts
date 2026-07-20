import type { Recipe } from "@/lib/recipeModel";

export type RepairMethodStep = {
  title: string;
  body: string;
};

export type RepairSnapshot = {
  title: string;
  author: string;
  sourceUrl: string;
  servings: string;
  ingredients: string[];
  method: RepairMethodStep[];
};

export type CompleteRepairPlanItem = {
  recipeId: string;
  slug: string;
  title: string;
  status: "ready" | "skipped";
  issueCodes: string[];
  expectedSnapshot: RepairSnapshot;
  selected: RepairSnapshot;
  changedFields: Array<"title" | "author" | "sourceUrl" | "servings" | "ingredients" | "method">;
  confidence: "automatic" | "manual_override";
  validation: {
    blockers: Array<{ code: string; level: string }>;
    warnings: Array<{ code: string; level: string }>;
  };
};

export type CompleteRepairPlan = {
  format: "recipe-library-complete-repair-plan-v1";
  generatedAt: string;
  auditGeneratedAt: string;
  readOnly: boolean;
  summary: {
    totalRecipes: number;
    alreadyHealthy: number;
    candidates: number;
    ready: number;
    skippedNoChange: number;
    manualOverrides: number;
    automaticRepairs: number;
    blockers: number;
  };
  items: CompleteRepairPlanItem[];
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function recipeIngredients(recipe: Recipe) {
  return recipe.ingredientSections.flatMap((section) =>
    section.items.map((item) => item.originalLine.trim()).filter(Boolean),
  );
}

function recipeMethod(recipe: Recipe): RepairMethodStep[] {
  return recipe.methodSections.flatMap((section) =>
    section.steps
      .map((step, index) => ({
        title: step.title?.trim() || `Step ${index + 1}`,
        body: step.body.trim(),
      }))
      .filter((step) => step.body),
  );
}

export function snapshotRecipe(recipe: Recipe): RepairSnapshot {
  return {
    title: recipe.title.trim(),
    author: recipe.source.author?.trim() || "",
    sourceUrl: recipe.source.originalUrl?.trim() || "",
    servings:
      recipe.yield.servingsDisplay?.trim() ||
      (recipe.yield.servings == null ? "" : String(recipe.yield.servings)),
    ingredients: recipeIngredients(recipe),
    method: recipeMethod(recipe),
  };
}

function sameLines(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((line, index) => normalize(line) === normalize(right[index] ?? ""));
}

function sameMethod(left: RepairMethodStep[], right: RepairMethodStep[]) {
  if (left.length !== right.length) return false;
  return left.every(
    (step, index) => normalize(step.body) === normalize(right[index]?.body ?? ""),
  );
}

export function snapshotsMatch(left: RepairSnapshot, right: RepairSnapshot) {
  return (
    normalize(left.title) === normalize(right.title) &&
    normalize(left.author) === normalize(right.author) &&
    normalize(left.sourceUrl) === normalize(right.sourceUrl) &&
    normalize(left.servings) === normalize(right.servings) &&
    sameLines(left.ingredients, right.ingredients) &&
    sameMethod(left.method, right.method)
  );
}

export function splitIngredientSections(lines: string[]) {
  const sections: Array<{ title: string | null; items: string[] }> = [];
  let active: { title: string | null; items: string[] } = { title: null, items: [] };

  const pushActive = () => {
    if (active.items.length) sections.push(active);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const isHeading = line.endsWith(":") && line.length <= 90;
    if (isHeading) {
      pushActive();
      active = { title: line.slice(0, -1).trim() || null, items: [] };
    } else {
      active.items.push(line);
    }
  }
  pushActive();

  return sections.length ? sections : [{ title: null, items: lines.filter(Boolean) }];
}
