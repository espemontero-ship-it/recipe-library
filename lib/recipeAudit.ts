import { ingredientDisplayLine } from "@/lib/ingredientParser";
import { getRecipeIngredients, getRecipeSteps, type Recipe } from "@/lib/recipeModel";
import { parseRecipe, type ParsedRecipe } from "@/lib/recipePasteParser";

export type RecipeAuditCategory = "healthy" | "safe_repair" | "review" | "no_source";
export type RecipeAuditIssueLevel = "safe" | "review" | "info";

export type RecipeAuditIssue = {
  code: string;
  label: string;
  detail: string;
  level: RecipeAuditIssueLevel;
};

export type RecipeAuditComparison = {
  currentIngredientCount: number;
  parsedIngredientCount: number;
  ingredientSimilarity: number;
  currentStepCount: number;
  parsedStepCount: number;
  methodSimilarity: number;
  currentTitle: string;
  parsedTitle: string;
  currentAuthor: string;
  parsedAuthor: string;
  currentUrl: string;
  parsedUrl: string;
};

export type RecipeAuditResult = {
  recipe: Recipe;
  category: RecipeAuditCategory;
  issues: RecipeAuditIssue[];
  parsed: ParsedRecipe | null;
  comparison: RecipeAuditComparison;
};

export type RecipeAuditReport = {
  generatedAt: string;
  summary: {
    total: number;
    healthy: number;
    safeRepair: number;
    review: number;
    noSource: number;
    withRawSource: number;
  };
  results: RecipeAuditResult[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u2044/g, "/")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(?:cucharadas?|cdas?|tablespoons?|tbsps?)\b/g, "tbsp")
    .replace(/\b(?:cucharaditas?|cditas?|cdtas?|teaspoons?|tsps?)\b/g, "tsp")
    .replace(/\b(?:gramos?|grams?|grs?)\b/g, "g")
    .replace(/\b(?:kilogramos?|kilograms?|kgs?)\b/g, "kg")
    .replace(/\b(?:mililitros?|milliliters?)\b/g, "ml")
    .replace(/\b(?:de|del|of|the|a|an)\b/g, " ")
    .replace(/[^a-z0-9¼½¾⅓⅔⅛⅜⅝⅞/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1 || /\d/.test(token)));
}

function lineSimilarity(left: string, right: string) {
  const leftNormalized = normalize(left);
  const rightNormalized = normalize(right);
  if (!leftNormalized && !rightNormalized) return 1;
  if (!leftNormalized || !rightNormalized) return 0;
  if (leftNormalized === rightNormalized) return 1;

  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  const jaccard = intersection / (leftTokens.size + rightTokens.size - intersection);
  return containment * 0.7 + jaccard * 0.3;
}

function overlapRatio(left: string[], right: string[]) {
  if (!left.length && !right.length) return 1;
  if (!left.length || !right.length) return 0;

  const remaining = new Set(right.map((_, index) => index));
  let matches = 0;
  for (const leftLine of left) {
    let bestIndex = -1;
    let bestScore = 0;
    for (const index of remaining) {
      const score = lineSimilarity(leftLine, right[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0 && bestScore >= 0.68) {
      matches += 1;
      remaining.delete(bestIndex);
    }
  }
  return matches / Math.max(left.length, right.length);
}

function textSimilarity(left: string[], right: string[]) {
  if (!left.length && !right.length) return 1;
  if (!left.length || !right.length) return 0;
  const leftTokens = tokens(left.join(" "));
  const rightTokens = tokens(right.join(" "));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
  const jaccard = intersection / (leftTokens.size + rightTokens.size - intersection);
  return containment * 0.7 + jaccard * 0.3;
}

function isParsedIngredientHeading(value: string) {
  const line = value.trim();
  return /:$/.test(line) && !/^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(line);
}

function parsedIngredientLines(parsed: ParsedRecipe | null) {
  return (parsed?.ingredients ?? []).filter((line) => !isParsedIngredientHeading(line));
}

function currentIngredientLines(recipe: Recipe) {
  return getRecipeIngredients(recipe)
    .map((ingredient) => ingredientDisplayLine(ingredient) || ingredient.originalLine)
    .map((line) => line.trim())
    .filter(Boolean);
}

function currentMethodLines(recipe: Recipe) {
  return getRecipeSteps(recipe)
    .map((step) => step.body.trim())
    .filter(Boolean);
}

function parseServingNumber(value: string | null | undefined) {
  const match = value?.match(/\d+(?:[.,]\d+)?/);
  return match ? Number.parseFloat(match[0].replace(",", ".")) : null;
}

function looksLikeMethodInsideIngredients(value: string) {
  const line = value.trim();
  if (line.length < 70) return false;
  return /[.!?]$/.test(line) || /^(?:add|combine|mix|stir|heat|cook|bake|place|whisk|serve|blend|preheat|añade|mezcla|calienta|cocina|hornea|coloca|bate|sirve|precalienta)\b/i.test(line);
}

function looksLikeIngredientInsideMethod(value: string) {
  const line = value.trim();
  return /^(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:g|gr|kg|ml|l|tbsp|tsp|cups?|cucharadas?|cucharaditas?|tazas?)?\b/i.test(line) && line.length < 100;
}

function addIssue(
  issues: RecipeAuditIssue[],
  code: string,
  label: string,
  detail: string,
  level: RecipeAuditIssueLevel,
) {
  if (issues.some((issue) => issue.code === code)) return;
  issues.push({ code, label, detail, level });
}

function sourceSuggestsIngredients(value: string) {
  if (/^(?:.*\n)?\s*[^\n]*(?:ingredients?|ingredientes?)\s*:?/im.test(value)) return true;
  const candidates = value
    .split(/\r?\n/)
    .filter((line) => /^(?:\s*[-*•▪✅✔]?\s*)(?:\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:g|gr|kg|ml|l|oz|lb|tbsp|tsp|cups?|cucharadas?|cucharaditas?|tazas?)?\b/i.test(line));
  return candidates.length >= 2;
}

function sourceSuggestsMethod(value: string) {
  if (/\b(?:method|instructions?|directions?|preparation|how\s+to\s+make|here(?:'s| is)\s+how|preparaci[oó]n|instrucciones?|m[eé]todo)\b/i.test(value)) return true;
  if (/^\s*(?:step|paso)\s*\d+|^\s*\d{1,2}[.)]\s*(?:add|mix|combine|cook|bake|heat|place|pour|blend|whisk|serve|a[ñn]ade|mezcla|cocina|hornea|coloca|sirve)\b/im.test(value)) return true;
  if (/[1-9](?:\uFE0F?\u20E3)\s*(?:add|mix|combine|cook|bake|heat|place|pour|blend|whisk|serve|a[ñn]ade|mezcla|cocina|hornea|coloca|sirve)\b/iu.test(value)) return true;
  return /^\s*[-•]\s*(?:add|mix|combine|cook|bake|heat|place|pour|blend|whisk|serve|top|a[ñn]ade|mezcla|cocina|hornea|coloca|sirve)\b/im.test(value);
}

export function auditRecipe(recipe: Recipe): RecipeAuditResult {
  const currentIngredients = currentIngredientLines(recipe);
  const currentMethod = currentMethodLines(recipe);
  const rawSource = recipe.rawSourceText?.trim() ?? "";
  const parsed = rawSource ? parseRecipe(rawSource) : null;
  const parsedIngredients = parsedIngredientLines(parsed);
  const parsedMethod = parsed?.method.map((step) => step.body) ?? [];
  const ingredientSimilarity = overlapRatio(currentIngredients, parsedIngredients);
  const methodSimilarity = Math.max(
    overlapRatio(currentMethod, parsedMethod),
    textSimilarity(currentMethod, parsedMethod),
  );
  const issues: RecipeAuditIssue[] = [];

  if (!rawSource) {
    addIssue(
      issues,
      "missing_raw_source",
      "Original text unavailable",
      "This recipe cannot be reparsed automatically because raw_source_text is empty.",
      "info",
    );
  }

  const corruptedIngredientLines = currentIngredients.filter(looksLikeMethodInsideIngredients);
  if (corruptedIngredientLines.length) {
    addIssue(
      issues,
      "method_inside_ingredients",
      "Method text found among ingredients",
      `${corruptedIngredientLines.length} ingredient line(s) look like preparation instructions.`,
      "review",
    );
  }

  const corruptedMethodLines = currentMethod.filter(looksLikeIngredientInsideMethod);
  if (corruptedMethodLines.length) {
    addIssue(
      issues,
      "ingredient_inside_method",
      "Ingredient text found in method",
      `${corruptedMethodLines.length} method step(s) look like ingredient lines.`,
      "review",
    );
  }

  if (parsed) {
    if (!parsed.title) {
      addIssue(issues, "parser_no_title", "Parser found no title", "Parser v2 could not recover a title from the original text.", "review");
    }
    if (!parsedIngredients.length && (currentIngredients.length > 0 || sourceSuggestsIngredients(rawSource))) {
      addIssue(issues, "parser_no_ingredients", "Parser found no ingredients", "The original text appears to contain ingredients, but they were not recovered.", "review");
    }
    if (!parsedMethod.length && (currentMethod.length > 0 || sourceSuggestsMethod(rawSource))) {
      addIssue(issues, "parser_no_method", "Parser found no method", "The original text appears to contain preparation steps, but they were not recovered.", "review");
    }

    if (!currentIngredients.length && parsedIngredients.length) {
      addIssue(
        issues,
        "missing_current_ingredients",
        "Ingredients can be recovered",
        `The saved recipe has no ingredients; Parser v2 recovered ${parsedIngredients.length}.`,
        "safe",
      );
    } else if (
      parsedIngredients.length >= 4 &&
      currentIngredients.length > 0 &&
      currentIngredients.length <= Math.floor(parsedIngredients.length * 0.4)
    ) {
      addIssue(
        issues,
        "severely_incomplete_ingredients",
        "Ingredient list appears incomplete",
        `Saved: ${currentIngredients.length}. Parser v2: ${parsedIngredients.length}.`,
        "safe",
      );
    } else if (
      currentIngredients.length &&
      parsedIngredients.length &&
      ingredientSimilarity < 0.55
    ) {
      addIssue(
        issues,
        "ingredient_disagreement",
        "Ingredient lists differ",
        `Only ${Math.round(ingredientSimilarity * 100)}% of normalized ingredient lines match.`,
        "review",
      );
    }

    if (!currentMethod.length && parsedMethod.length) {
      addIssue(
        issues,
        "missing_current_method",
        "Method can be recovered",
        `The saved recipe has no method; Parser v2 recovered ${parsedMethod.length} step(s).`,
        "safe",
      );
    } else if (
      parsedMethod.length >= 3 &&
      currentMethod.length > 0 &&
      currentMethod.length <= Math.floor(parsedMethod.length * 0.4)
    ) {
      addIssue(
        issues,
        "severely_incomplete_method",
        "Method appears incomplete",
        `Saved: ${currentMethod.length}. Parser v2: ${parsedMethod.length}.`,
        "safe",
      );
    } else if (currentMethod.length && parsedMethod.length && methodSimilarity < 0.5) {
      addIssue(
        issues,
        "method_disagreement",
        "Preparation steps differ",
        `Only ${Math.round(methodSimilarity * 100)}% of normalized steps match.`,
        "review",
      );
    }

    const currentTitle = normalize(recipe.title);
    const parsedTitle = normalize(parsed.title);
    const parsedAuthor = normalize(parsed.author);
    const currentAuthor = normalize(recipe.source.author);

    const titleIsAuthor = Boolean(
      parsedTitle &&
      currentTitle &&
      parsedTitle !== currentTitle &&
      (currentTitle === parsedAuthor || (currentAuthor && currentTitle === currentAuthor)),
    );

    if (titleIsAuthor) {
      addIssue(
        issues,
        "title_is_author",
        "Author stored as title",
        `Parser v2 identifies “${parsed.title}” as the title and “${parsed.author}” as the author.`,
        "safe",
      );
    } else if (parsedTitle && currentTitle && parsedTitle !== currentTitle) {
      addIssue(
        issues,
        "title_disagreement",
        "Title differs from original text",
        `Saved: “${recipe.title}”. Parser v2: “${parsed.title}”.`,
        "review",
      );
    }

    if (!recipe.source.author && parsed.author) {
      addIssue(issues, "missing_author", "Author can be recovered", `Parser v2 found “${parsed.author}”.`, "safe");
    } else if (
      recipe.source.author &&
      parsed.author &&
      normalize(recipe.source.author) !== normalize(parsed.author)
    ) {
      addIssue(
        issues,
        "author_disagreement",
        "Author differs",
        `Saved: “${recipe.source.author}”. Parser v2: “${parsed.author}”.`,
        "review",
      );
    }

    if (!recipe.source.originalUrl && parsed.sourceUrl) {
      addIssue(issues, "missing_source_url", "Source URL can be recovered", parsed.sourceUrl, "safe");
    }

    const currentServings = recipe.yield.servings ?? parseServingNumber(recipe.yield.servingsDisplay);
    const parsedServings = parseServingNumber(parsed.servings);
    if (currentServings !== null && parsedServings !== null && currentServings !== parsedServings) {
      addIssue(
        issues,
        "servings_disagreement",
        "Servings differ",
        `Saved: ${currentServings}. Parser v2: ${parsedServings}.`,
        "review",
      );
    }
  }

  const category: RecipeAuditCategory = !rawSource
    ? "no_source"
    : issues.some((issue) => issue.level === "review")
      ? "review"
      : issues.some((issue) => issue.level === "safe")
        ? "safe_repair"
        : "healthy";

  return {
    recipe,
    category,
    issues,
    parsed,
    comparison: {
      currentIngredientCount: currentIngredients.length,
      parsedIngredientCount: parsedIngredients.length,
      ingredientSimilarity,
      currentStepCount: currentMethod.length,
      parsedStepCount: parsedMethod.length,
      methodSimilarity,
      currentTitle: recipe.title,
      parsedTitle: parsed?.title ?? "",
      currentAuthor: recipe.source.author ?? "",
      parsedAuthor: parsed?.author ?? "",
      currentUrl: recipe.source.originalUrl ?? "",
      parsedUrl: parsed?.sourceUrl ?? "",
    },
  };
}

export function auditRecipes(recipes: Recipe[]): RecipeAuditReport {
  const results = recipes.map(auditRecipe).sort((left, right) => {
    const categoryOrder: Record<RecipeAuditCategory, number> = {
      review: 0,
      safe_repair: 1,
      no_source: 2,
      healthy: 3,
    };
    return categoryOrder[left.category] - categoryOrder[right.category] ||
      left.recipe.title.localeCompare(right.recipe.title, undefined, { sensitivity: "base" });
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      healthy: results.filter((result) => result.category === "healthy").length,
      safeRepair: results.filter((result) => result.category === "safe_repair").length,
      review: results.filter((result) => result.category === "review").length,
      noSource: results.filter((result) => result.category === "no_source").length,
      withRawSource: results.filter((result) => Boolean(result.recipe.rawSourceText?.trim())).length,
    },
    results,
  };
}
