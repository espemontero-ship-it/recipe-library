import { getRecipeIngredients, getRecipeSteps } from "@/lib/recipeModel";
import type { RecipeAuditResult } from "@/lib/recipeAudit";

export const REPAIR_FIELDS = [
  "title",
  "author",
  "sourceUrl",
  "servings",
  "ingredients",
  "method",
] as const;

export type RepairField = (typeof REPAIR_FIELDS)[number];
export type RepairChoice = "saved" | "parser" | "custom";
export type RepairReviewStatus = "unreviewed" | "ready" | "skipped";

export type RepairDecision = {
  recipeId: string;
  status: RepairReviewStatus;
  choices: Record<RepairField, RepairChoice>;
  custom: {
    title: string;
    author: string;
    sourceUrl: string;
    servings: string;
    ingredients: string;
    method: string;
  };
  updatedAt: string;
};

export type RepairPlanItem = {
  recipeId: string;
  slug: string;
  title: string;
  expectedUpdatedAt: string;
  status: Exclude<RepairReviewStatus, "unreviewed">;
  issueCodes: string[];
  selected: {
    title: string;
    author: string;
    sourceUrl: string;
    servings: string;
    ingredients: string[];
    method: Array<{ title: string; body: string }>;
  };
  choices: Record<RepairField, RepairChoice>;
};

function emptyChoices(): Record<RepairField, RepairChoice> {
  return {
    title: "saved",
    author: "saved",
    sourceUrl: "saved",
    servings: "saved",
    ingredients: "saved",
    method: "saved",
  };
}

function currentIngredients(result: RecipeAuditResult) {
  return getRecipeIngredients(result.recipe).map((ingredient) => ingredient.originalLine.trim()).filter(Boolean);
}

function currentMethod(result: RecipeAuditResult) {
  return getRecipeSteps(result.recipe).map((step) => ({ title: step.title ?? "", body: step.body.trim() })).filter((step) => step.body);
}

function currentServings(result: RecipeAuditResult) {
  const display = result.recipe.yield.servingsDisplay?.trim();
  if (display) return display;
  return result.recipe.yield.servings == null ? "" : String(result.recipe.yield.servings);
}

export function createDefaultRepairDecision(result: RecipeAuditResult): RepairDecision {
  const choices = emptyChoices();
  const safeCodes = new Set(result.issues.filter((issue) => issue.level === "safe").map((issue) => issue.code));

  if (safeCodes.has("missing_current_ingredients") || safeCodes.has("severely_incomplete_ingredients")) {
    choices.ingredients = "parser";
  }
  if (safeCodes.has("missing_current_method") || safeCodes.has("severely_incomplete_method")) {
    choices.method = "parser";
  }
  if (safeCodes.has("missing_author")) choices.author = "parser";
  if (safeCodes.has("missing_source_url")) choices.sourceUrl = "parser";
  if (safeCodes.has("title_is_author")) {
    choices.title = "parser";
    choices.author = "parser";
  }

  return {
    recipeId: result.recipe.id,
    status: "unreviewed",
    choices,
    custom: {
      title: result.recipe.title,
      author: result.recipe.source.author ?? "",
      sourceUrl: result.recipe.source.originalUrl ?? "",
      servings: currentServings(result),
      ingredients: currentIngredients(result).join("\n"),
      method: currentMethod(result).map((step) => step.body).join("\n\n"),
    },
    updatedAt: new Date().toISOString(),
  };
}

function chooseScalar(
  choice: RepairChoice,
  saved: string,
  parsed: string,
  custom: string,
) {
  if (choice === "parser") return parsed;
  if (choice === "custom") return custom;
  return saved;
}

function customIngredientLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function customMethodSteps(value: string) {
  const blocks = value
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^\s*(?:step\s*)?\d+[.)\-:]?\s*/i, "").trim())
    .filter(Boolean);
  return blocks.map((body, index) => ({ title: `Step ${index + 1}`, body }));
}

export function resolveRepairSelection(result: RecipeAuditResult, decision: RepairDecision) {
  const parsed = result.parsed;
  const savedIngredients = currentIngredients(result);
  const savedMethod = currentMethod(result);
  const parsedIngredients = parsed?.ingredients ?? [];
  const parsedMethod = parsed?.method ?? [];

  const ingredients = decision.choices.ingredients === "parser"
    ? parsedIngredients
    : decision.choices.ingredients === "custom"
      ? customIngredientLines(decision.custom.ingredients)
      : savedIngredients;

  const method = decision.choices.method === "parser"
    ? parsedMethod
    : decision.choices.method === "custom"
      ? customMethodSteps(decision.custom.method)
      : savedMethod;

  return {
    title: chooseScalar(
      decision.choices.title,
      result.recipe.title,
      parsed?.title ?? "",
      decision.custom.title,
    ).trim(),
    author: chooseScalar(
      decision.choices.author,
      result.recipe.source.author ?? "",
      parsed?.author ?? "",
      decision.custom.author,
    ).trim(),
    sourceUrl: chooseScalar(
      decision.choices.sourceUrl,
      result.recipe.source.originalUrl ?? "",
      parsed?.sourceUrl ?? "",
      decision.custom.sourceUrl,
    ).trim(),
    servings: chooseScalar(
      decision.choices.servings,
      currentServings(result),
      parsed?.servings ?? "",
      decision.custom.servings,
    ).trim(),
    ingredients: ingredients.map((line) => line.trim()).filter(Boolean),
    method: method.map((step, index) => ({
      title: step.title?.trim() || `Step ${index + 1}`,
      body: step.body.trim(),
    })).filter((step) => step.body),
  };
}

export function createRepairPlanItem(
  result: RecipeAuditResult,
  decision: RepairDecision,
): RepairPlanItem | null {
  if (decision.status === "unreviewed") return null;
  return {
    recipeId: result.recipe.id,
    slug: result.recipe.slug,
    title: result.recipe.title,
    expectedUpdatedAt: result.recipe.updatedAt,
    status: decision.status,
    issueCodes: result.issues.map((issue) => issue.code),
    selected: resolveRepairSelection(result, decision),
    choices: decision.choices,
  };
}
