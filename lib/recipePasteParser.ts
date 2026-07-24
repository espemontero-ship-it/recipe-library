export type NutritionRange = {
  min: string;
  max: string;
};

export type ParsedRecipe = {
  title: string;
  summary: string;
  author: string;
  publication: string;
  sourceType: string;
  sourceUrl: string;
  imageUrl: string;
  imageStatus: "found_clipboard" | "found_source" | "missing";
  imageWarning: string;
  servings: string;
  time: string;
  prepMinutes: string;
  cookMinutes: string;
  restingMinutes: string;
  marinatingMinutes: string;
  totalMinutes: string;
  ingredients: string[];
  method: { title: string; body: string }[];
  calories: NutritionRange;
  protein: NutritionRange;
  carbs: NutritionRange;
  fat: NutritionRange;
  fiber: NutritionRange;
  servingSuggestion: string;
  mainIngredients: string[];
  dish: string[];
  formats: string[];
  mealTypes: string[];
  methods: string[];
  cuisines: string[];
  collections: string[];
  publicNotes: string;
};

export type PasteContext = {
  sourceUrl?: string;
  imageUrl?: string;
};

const TRACKING_PARAMETERS = new Set([
  "campaign_id",
  "emc",
  "instance_id",
  "nl",
  "regi_id",
  "segment_id",
  "user_id",
  "smid",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

const SECTION_HEADINGS = {
  ingredients: /^(?:ingredients?|ingredientes?)(?:\s*[,–—-]?\s*(?!are\b).{1,90})?\s*:?$/i,
  method: /^(?:preparation|method|directions?|instructions?|steps?|how\s+to\s+make(?:\s+it)?|here(?:'s| is)\s+how\s+(?:i\s+)?(?:made|make)\s+it|preparaci[oó]n|m[eé]todo|elaboraci[oó]n|instrucciones?)(?:\s*\([^)]*\)|\s*[-–—:].*)?\s*:?$/i,
  nutrition: /^(?:approximate\s+)?(?:nutrition(?:al\s+information)?|nutrici[oó]n|informaci[oó]n\s+nutricional|macros?)(?:\s*\([^)]*\)|\s*[-–—:].*)?\s*:?$/i,
  serving: /^(?:serving suggestion|to serve|sugerencia de servicio)\s*:?$/i,
};

const UI_OR_JUNK_LINE = /^(?:save|saved|print|share|email|copy link|rate|rating|ratings|comments?|read more|see less|ver menos|add to your grocery list|add ingredients to grocery list|ingredient substitution guide|private notes?|unlock this recipe|subscribe|sign in|log in|view recipe|featured recipe|advertisement|skip advertisement)\b/i;
const CREDIT_LINE = /(?:\bcredit\b|\bphoto(?:graph)?\s*(?:by|:)|\bfood stylist\b|\bprop stylist\b|\bstyled by\b|\bphotographer\b)/i;
const NYT_NAV_OR_META_LINE = /^(?:recipes?|occasions|articles|about|give|published\s+.+|updated\s+.+|media\s+\d+\s+of\s+\d+|read\s+\d[\d,.]*\s+comments?|\(?\d[\d,.]*\)?|total time|prep time|cook time)$/i;
const URL_LINE = /^https?:\/\/\S+$/i;
const SOCIAL_FOOTER_LINE = /^(?:link in bio|follow(?: me)? for more|full recipe(?: in| at)|recipe link(?: in| at)|save this recipe)\b/i;
const SOCIAL_NETWORK_TYPES = new Set(["facebook", "instagram", "tiktok"]);
const SOCIAL_PROFILE_ACTION_LINE = /^(?:follow|following|seguir|siguiendo)$/i;
const SOCIAL_SEPARATOR_LINE = /^(?:[·•|]\s*)+$/;
const SOCIAL_AUDIO_LINE = /^.{1,80}\s+·\s+.{1,80}$/;
const MACRO_LINE = /^(?:(?:calories?|calor[ií]as|protein|prote[ií]na|carbs?|carbohydrates?|hidratos|fat|grasa|fib(?:er|re|ra))\s*:|(?:~?\d+(?:[.,]\d+)?\s*g?\s*(?:protein|prote[ií]na|carbs?|carbohydrates?|hidratos|fat|grasa|fib(?:er|re|ra))\s*$)|(?:(?:per\s+(?:serving|bowl|portion)|each\s+serving|recipe\s+complete|receta\s+completa|\d+\/\d+\s+receta)\s*:?\s*)?.*\b(?:k?cal(?:ories)?|calor[ií]as)\b.*(?:protein|prote[ií]na|carbs?|hidratos|fat|grasa)?|(?:\d+(?:[.,]\d+)?\s*[gG]?\s*(?:P|C|F)(?:\s*[|·/]\s*)?){2,})/i;

export const emptyRange = (): NutritionRange => ({ min: "", max: "" });

export function stripMarkdown(value: string) {
  return value
    .replace(/\*/g, "")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .trim();
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normalizeText(value: string) {
  return decodeBasicEntities(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]+/g, "\n")
    .replace(/\uFFFD+/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\u2044/g, "/")
    .replace(/[ \t]+$/gm, "")
    .replace(/\s+(?=(?:Ingredients?|Ingredientes?|Method|Instructions?|Directions?|Preparation|Preparaci[oó]n)\s*[:：]?\s*(?:[•▪✅✔▢]|\d|[¼½¾⅓⅔⅛⅜⅝⅞]))/gi, "\n")
    .replace(/((?:Ingredients?|Ingredientes?|Method|Instructions?|Directions?|Preparation|Preparaci[oó]n)\s*[:：]?)\s*(?=(?:[•▪✅✔▢]|\d|[¼½¾⅓⅔⅛⅜⅝⅞]))/gi, "$1\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}


function compactSocialHeaderLines(header: string, sourceUrl: string) {
  let cleaned = header.replace(sourceUrl, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const profileMatch = cleaned.match(
    /^(.*?)\s+[·•]\s*(Follow|Following|Seguir|Siguiendo)\s+(.+)$/i,
  );
  if (!profileMatch) return [cleaned];

  const author = profileMatch[1].trim();
  const action = profileMatch[2].trim();
  let remainder = profileMatch[3].trim();
  const lines = [author, "·", action];

  const audioMatch = remainder.match(
    /^(.{1,80}?\s+[·•]\s+[\p{Ll}\d][\p{Ll}\d'’&+\-]*(?:\s+[\p{Ll}\d][\p{Ll}\d'’&+\-]*){0,5})\s+(?=[\p{Lu}])(.*)$/u,
  );
  if (audioMatch) {
    lines.push(audioMatch[1].trim());
    remainder = audioMatch[2].trim();
  }

  if (remainder) lines.push(remainder);
  return lines.filter(Boolean);
}

function splitCompactIngredientRows(value: string) {
  const headingPattern = /(Dipping Sauce|To Serve|For Serving|Para servir|[A-ZÁÉÍÓÚÑ][A-Za-zÀ-ÿ'’\-]*(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÀ-ÿ'’\-]*)*\s+(?:Sauce|Dressing|Marinade|Glaze|Topping))/g;
  let expanded = value
    .replace(headingPattern, "\n$1\n")
    .replace(
      /\s+(?=(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*[A-Za-zÀ-ÿ])/g,
      "\n",
    )
    .replace(/\s+(?=(?:Oil spray|Cooking spray|Salt and pepper|Salt|Pepper)(?:\s|$))/g, "\n");

  const rawRows = expanded
    .split("\n")
    .map((row) => row.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows: string[] = [];
  let splitUnquantified = false;

  for (const row of rawRows) {
    const heading = /^(?:To Serve|For Serving|Para servir)$/i.test(row);
    if (heading) {
      rows.push(row);
      splitUnquantified = true;
      continue;
    }

    if (/^(?:Dipping Sauce|[A-ZÁÉÍÓÚÑ].*(?:Sauce|Dressing|Marinade|Glaze|Topping))$/i.test(row)) {
      rows.push(row);
      splitUnquantified = false;
      continue;
    }

    if (splitUnquantified && !/^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(row)) {
      rows.push(
        ...row
          .split(/\s+(?=[A-ZÁÉÍÓÚÑ][a-záéíóúñ])/)
          .map((part) => part.trim())
          .filter(Boolean),
      );
      continue;
    }

    rows.push(row);
  }

  return rows;
}

function expandCompactSocialPaste(value: string, sourceType: string, sourceUrl: string) {
  if (!SOCIAL_NETWORK_TYPES.has(sourceType)) return value;
  if ((value.match(/\n/g) ?? []).length > 2) return value;

  const ingredientsMatch = /\bIngredients?\b/i.exec(value);
  if (!ingredientsMatch) return value;

  const beforeIngredients = value.slice(0, ingredientsMatch.index).trim();
  const afterIngredients = value.slice(ingredientsMatch.index + ingredientsMatch[0].length).trim();
  const methodMatch = /\s1[.)]\s+[A-ZÁÉÍÓÚÑ]/.exec(afterIngredients);
  const ingredientBlock = methodMatch
    ? afterIngredients.slice(0, methodMatch.index).trim()
    : afterIngredients;
  const methodBlock = methodMatch
    ? afterIngredients.slice(methodMatch.index + 1).trim()
    : "";

  const headerLines = compactSocialHeaderLines(beforeIngredients, sourceUrl);
  const ingredientLines = splitCompactIngredientRows(ingredientBlock);
  const methodLines = methodBlock
    ? methodBlock
        .split(/\s+(?=\d{1,2}[.)]\s+[A-ZÁÉÍÓÚÑ])/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return [sourceUrl, ...headerLines, "Ingredients", ...ingredientLines, ...methodLines]
    .filter(Boolean)
    .join("\n");
}

export function cleanLine(value: string) {
  return stripMarkdown(
    value
      .replace(/^\s*[-*•]\s*/, "")
      .replace(/^\s*\d+\s*[.)]\s*/, "")
      .trim(),
  )
    .replace(/\s*(?:See less|Ver menos)\s*$/i, "")
    .trim();
}

function stripLeadingDecorators(value: string) {
  return value
    .replace(
      /^\s*(?:(?:[-*•‣▪◦✅✔☑✳❇🛒👉📌📝]\uFE0F?)|(?:[\p{Extended_Pictographic}]\uFE0F?))+\s*/u,
      "",
    )
    .trim();
}

function cleanContentLine(value: string) {
  return stripLeadingDecorators(cleanLine(value))
    .replace(/^\s*[—–-]+\s*/, "")
    .trim();
}

function normalizedHeadingLine(value: string) {
  return cleanContentLine(value)
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

function isMacroLine(value: string) {
  const line = cleanContentLine(value);
  if (!line) return false;
  if (MACRO_LINE.test(line)) return true;
  const nutrientValues = line.match(/\d+(?:[.,]\d+)?\s*g?\s*(?:protein|prote[ií]na|carbs?|carbohydrates?|hidratos|fat|grasa|fib(?:er|re|ra)|calories?|calor[ií]as|kcal)\b/gi) ?? [];
  if (nutrientValues.length >= 2) return true;
  return /^(?:each\s+serving|per\s+serving|macros?\s+per|total\s+with\s+toppings|cantidad\s+kcal)\b/i.test(line);
}

const ACTION_START = /^(?:add|arrange|bake|beat|blend|boil|brush|chill|combine|cook|cover|cut|divide|drizzle|fill|fold|freeze|fry|grill|heat|hydrate|insert|knead|marinate|microwave|mix|place|pour|preheat|process|remove|rest|roll|season|serve|shape|slice|spoon|spray|stir|top|toss|whisk|air\s+fry|a[ñn]ade|agrega|bate|calienta|cocina|coloca|combina|corta|deja|divide|dora|escurr|fr[ií]e|hornea|hidrata|mezcla|precalienta|rellena|retira|sirve|saltea|tritura)\b/i;

function looksLikeActionLine(value: string) {
  const line = cleanContentLine(value);
  return ACTION_START.test(line) || (line.length > 55 && /[.!?]$/.test(line));
}

function cleanTitle(value: string) {
  return stripMarkdown(value)
    .replace(/^\s*[-–—|:]+\s*/, "")
    .replace(/\s*\|\s*NYT Cooking\s*$/i, "")
    .trim();
}

export function normalizeSourceUrl(value: string) {
  const trimmed = value
    .trim()
    .replace(/[\s\u00a0]+$/g, "")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/[)\]}]+$/g, "");

  try {
    const url = new URL(trimmed);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (TRACKING_PARAMETERS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\?$/, "");
  } catch {
    return trimmed;
  }
}

function urlScore(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    let score = 0;
    if (host === "cooking.nytimes.com" && path.includes("/recipes/")) score += 100;
    if (path.includes("/recipe") || path.includes("/recipes/")) score += 50;
    if (/instagram\.com|tiktok\.com|facebook\.com|youtube\.com/.test(host)) score += 30;
    if (host.includes("nytimes.com")) score += 20;
    return score;
  } catch {
    return -1;
  }
}

export function extractSourceUrl(value: string) {
  const urls: string[] = [];
  for (const match of value.matchAll(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi)) {
    urls.push(normalizeSourceUrl(match[1]));
  }
  for (const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    urls.push(normalizeSourceUrl(match[0]));
  }

  return Array.from(new Set(urls))
    .sort((a, b) => urlScore(b) - urlScore(a))[0] ?? "";
}

export function sourceFromUrl(value: string) {
  if (!value) return "";
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "cooking.nytimes.com") return "NYT Cooking";
    if (host.endsWith("nytimes.com")) return "The New York Times";
    if (host.endsWith("instagram.com")) return "Instagram";
    if (host.endsWith("tiktok.com")) return "TikTok";
    if (host.endsWith("facebook.com")) return "Facebook";
    if (host.endsWith("youtube.com") || host === "youtu.be") return "YouTube";
    return host;
  } catch {
    return "";
  }
}

export function sourceTypeFromUrl(value: string) {
  if (!value) return "";
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("facebook.com")) return "facebook";
    return "web";
  } catch {
    return "";
  }
}

function isJunkLine(value: string) {
  const line = cleanLine(value);
  return (
    !line ||
    UI_OR_JUNK_LINE.test(line) ||
    CREDIT_LINE.test(line) ||
    NYT_NAV_OR_META_LINE.test(line) ||
    /^image\b/i.test(line)
  );
}

function isHeading(value: string, pattern: RegExp) {
  return pattern.test(normalizedHeadingLine(value));
}

function findSectionStart(lines: string[], pattern: RegExp) {
  return lines.findIndex((line) => isHeading(line, pattern));
}

function isServingsLine(value: string) {
  const line = cleanContentLine(value);
  return /^(?:para\s+\d+(?:[.,]\d+)?\s+personas?|(?:(?:recipe\s*)?\(?\s*(?:yield|servings?|serves|makes|raciones?|porciones?)?\s*:?\s*(?:about\s*)?\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:servings?|raciones?|porciones?)?\s*\)?\s*:?))$/i.test(line) ||
    /^(?:recipe\s*)?\(\s*\d+(?:[.,]\d+)?\s+(?:servings?|raciones?|porciones?)\s*\)\s*:?$/i.test(line);
}

function findIngredientsSectionStart(lines: string[]) {
  const candidates = lines
    .map((line, index) => (isHeading(line, SECTION_HEADINGS.ingredients) ? index : -1))
    .filter((index) => index >= 0);

  if (!candidates.length) return -1;
  if (candidates.length === 1) return candidates[0];

  let bestIndex = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const methodOffset = lines
      .slice(candidate + 1)
      .findIndex((line) => isHeading(line, SECTION_HEADINGS.method));
    const end = methodOffset >= 0 ? candidate + 1 + methodOffset : Math.min(lines.length, candidate + 90);
    const section = lines.slice(candidate + 1, end);
    const firstUseful = section.find((line) => cleanLine(line) && !isJunkLine(line));
    const ingredientCount = section.filter(isIngredientLikeLine).length;
    const editorialCount = section.slice(0, 30).filter((line) => NYT_NAV_OR_META_LINE.test(cleanLine(line))).length;
    const score =
      ingredientCount * 20 +
      (firstUseful && isServingsLine(firstUseful) ? 40 : 0) -
      editorialCount * 12 +
      candidate / 1000;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = candidate;
    }
  }

  return bestIndex;
}

function findSectionEnd(lines: string[], start: number, patterns: RegExp[]) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (patterns.some((pattern) => isHeading(lines[index], pattern))) return index;
  }
  return lines.length;
}

function lineAfterHeading(lines: string[], patterns: RegExp[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanLine(lines[index]);
    if (!patterns.some((pattern) => pattern.test(line))) continue;

    const inline = line.match(/^[^:]+:\s*(.+)$/);
    if (inline?.[1]?.trim()) return inline[1].trim();

    for (let next = index + 1; next < Math.min(lines.length, index + 4); next += 1) {
      const candidate = cleanLine(lines[next]);
      if (!candidate || isJunkLine(candidate) || URL_LINE.test(candidate)) continue;
      return candidate;
    }
  }
  return "";
}

function isIngredientLikeLine(value: string) {
  const line = cleanContentLine(value);
  if (!line || isJunkLine(line) || URL_LINE.test(line) || isMacroLine(line)) return false;
  if (/^(?:yield|servings?|serves|makes|time|total time|prep time|cook time|recipe by|by|original recipe)\b/i.test(line)) {
    return false;
  }
  if (/\b(?:prep|cook(?:ing)?|total)\s*(?:time)?\b/i.test(line) && /\b(?:min|mins?|minutes?|hours?|hrs?)\b/i.test(line)) return false;
  if (/^\d+(?:[.,]\d+)?\s*(?:min|mins?|minutes?|hours?|hrs?)\b/i.test(line)) return false;
  if (looksLikeActionLine(line)) return false;

  const quantityLed = /^(?:\(?\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*[¼½¾⅓⅔⅛⅜⅝⅞])?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|un\b|una\b|uno\b|dos\b|tres\b|cuatro\b|cinco\b|seis\b|half\b|media?\b|unas?\s+\d)/i.test(line);
  const qualitative = /^(?:a\s+(?:pinch|dash|handful|splash)\b|pinch\b|dash\b|handful\b|splash\b|salt\b|pepper\b|oil spray\b|cooking spray\b|juice\s+(?:and\s+zest\s+)?of\b|zest\s+(?:and\s+juice\s+)?of\b|jugo\s+de\b|ralladura\s+y\s+zumo\b)/i.test(line);
  const ingredientFirst = /^[^,]{2,80},\s*(?:about\s*)?(?:\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:g|gr|kg|ml|l|oz|fl\s*oz|lb|lbs|cup|cups|tbsp|tsp)\b|\s*(?:,|$))/i.test(line);
  const trailingMeasure = /^[^,\d]{2,80}\s+(?:\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:g|gr|kg|ml|l|oz|lb|lbs)\b/i.test(line);
  return quantityLed || qualitative || ingredientFirst || trailingMeasure;
}

function looksLikeIngredientSubheading(value: string) {
  const line = cleanContentLine(value);
  if (!line || isJunkLine(line) || isIngredientLikeLine(line) || isMacroLine(line)) return false;
  if (line.length > 60 || /[.!?]$/.test(line)) return false;
  return /^(?:for\b|para\b|to serve\b|for serving\b|optional\b|garnish\b|sauce\b|marinade\b)/i.test(line) ||
    /(?:salsa|sauce|dressing|marinade|glaze|topping|relleno|cobertura)$/i.test(line) ||
    /:$/.test(line);
}

function looksLikeStepBody(value: string) {
  const line = cleanContentLine(value);
  return looksLikeActionLine(line) || /^(?:in|into|using|once|meanwhile|when|after|then|meanwhile|with)\b/i.test(line);
}

function isReliableMethodMarker(value: string) {
  const marker = methodMarker(value);
  if (!marker) return false;
  if (/^\s*(?:step|paso)\s*\d+/i.test(value) || /^\s*[1-9](?:\uFE0F?\u20E3)/u.test(value)) return true;
  return Boolean(marker.inlineBody && looksLikeStepBody(marker.inlineBody));
}

function findImplicitMethodStart(lines: string[], start = -1) {
  let ingredientLikeSeen = 0;
  for (let index = Math.max(0, start + 1); index < lines.length; index += 1) {
    const line = cleanContentLine(lines[index]);
    if (!line) continue;
    if (isIngredientLikeLine(line)) {
      ingredientLikeSeen += 1;
      continue;
    }
    if (isReliableMethodMarker(lines[index])) return index;
    if (ingredientLikeSeen >= 2 && looksLikeStepBody(line) && !looksLikeIngredientSubheading(line)) return index;
  }
  return -1;
}

function ingredientHeadingSuffix(value: string) {
  const line = normalizedHeadingLine(value).replace(/:\s*$/, "");
  const match = line.match(/^(?:ingredients?|ingredientes?)\s*[,–—-]?\s+(.+)$/i);
  if (!match) return "";
  const suffix = match[1].trim();
  if (/^(?:for|para)?\s*\d+(?:[.,]\d+)?\s*(?:servings?|serves?|raciones?|porciones?)?\)?$/i.test(suffix)) return "";
  if (/^\([^)]*(?:servings?|raciones?|porciones?)[^)]*\)$/i.test(suffix)) return "";
  if (!/[\p{L}]/u.test(suffix)) return "";
  return suffix.replace(/^for\s+/i, "").trim();
}

function pushIngredientHeading(ingredients: string[], value: string) {
  const heading = cleanContentLine(value).replace(/:\s*$/, "").trim();
  if (!heading || ingredients[ingredients.length - 1] === `${heading}:`) return;
  ingredients.push(`${heading}:`);
}

function parseExplicitIngredients(lines: string[], start: number) {
  const explicitEnd = findSectionEnd(lines, start, [SECTION_HEADINGS.method, SECTION_HEADINGS.nutrition]);
  const implicitMethodStart = findImplicitMethodStart(lines, start);
  const end = implicitMethodStart >= 0 ? Math.min(explicitEnd, implicitMethodStart) : explicitEnd;
  const ingredients: string[] = [];
  const initialSuffix = ingredientHeadingSuffix(lines[start]);
  if (initialSuffix) pushIngredientHeading(ingredients, initialSuffix);

  for (let index = start + 1; index < end; index += 1) {
    const rawLine = lines[index];
    const line = cleanContentLine(rawLine);
    if (!line || isJunkLine(line) || URL_LINE.test(line) || isMacroLine(line) || isDecorativeSeparator(line)) continue;
    if (isHeading(rawLine, SECTION_HEADINGS.method) || isHeading(rawLine, SECTION_HEADINGS.nutrition)) break;
    if (isHeading(rawLine, SECTION_HEADINGS.ingredients)) {
      const suffix = ingredientHeadingSuffix(rawLine);
      if (suffix) pushIngredientHeading(ingredients, suffix);
      continue;
    }
    if (isServingsLine(line) || /^(?:yield|servings?|serves|makes|recipe\s*\(|raciones?|porciones?)\s*:?/i.test(line)) continue;
    if (/^(?:ingredient checklist|ingredient substitution guide)$/i.test(line)) continue;

    if (looksLikeIngredientSubheading(line)) {
      pushIngredientHeading(ingredients, line);
      continue;
    }

    if (isIngredientLikeLine(line) || (line.length <= 220 && !/[.!?]$/.test(line) && !looksLikeActionLine(line))) {
      ingredients.push(line);
    }
  }

  return ingredients;
}

function parseImplicitIngredients(lines: string[], recipeTitle: string, recipeAuthor = "") {
  const methodHeading = findSectionStart(lines, SECTION_HEADINGS.method);
  const implicitMethod = findImplicitMethodStart(lines, -1);
  const nutritionStart = findSectionStart(lines, SECTION_HEADINGS.nutrition);
  const boundaries = [methodHeading, implicitMethod, nutritionStart].filter((value) => value >= 0);
  const end = boundaries.length ? Math.min(...boundaries) : lines.length;
  const ingredients: string[] = [];
  let started = false;

  for (let index = 0; index < end; index += 1) {
    const rawLine = lines[index];
    const rawTrimmed = rawLine.trim();
    const line = cleanContentLine(rawLine);
    if (!line || URL_LINE.test(line) || isJunkLine(line) || isMacroLine(line)) continue;
    if (recipeTitle && cleanTitle(rawLine) === recipeTitle) continue;
    if (recipeAuthor && cleanContentLine(rawLine).replace(/^@/, "") === recipeAuthor.replace(/^@/, "")) continue;
    if (isServingsLine(line) || /^(?:recipe\s*\(|yield|servings?|serves|makes|raciones?|porciones?)\b/i.test(line)) continue;
    if (/^#\w/.test(rawTrimmed) || SOCIAL_FOOTER_LINE.test(line)) break;

    if (isIngredientLikeLine(line)) {
      started = true;
      ingredients.push(line);
      continue;
    }

    const nextUseful = lines
      .slice(index + 1, Math.min(end, index + 5))
      .map(cleanContentLine)
      .find((candidate) => candidate && !isMacroLine(candidate) && !isServingsLine(candidate));
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    const shortHeadingBeforeIngredient = line.length <= 60 && !/[.!?]$/.test(line) &&
      (/:\s*$/.test(rawLine.trim()) || looksLikeIngredientSubheading(line) || wordCount >= 2) &&
      Boolean(nextUseful && isIngredientLikeLine(nextUseful));

    if ((started && looksLikeIngredientSubheading(line)) || shortHeadingBeforeIngredient) {
      started = true;
      pushIngredientHeading(ingredients, line);
      continue;
    }

    if (started && line.length <= 90 && !/[.!?]$/.test(line) && !looksLikeActionLine(line) && !isDecorativeSeparator(line)) {
      ingredients.push(line);
    }
  }

  while (ingredients.length && /^(?:what you need|recipe|ingredients?)\s*:?$/i.test(ingredients[0])) ingredients.shift();
  return ingredients;
}

function parseIngredients(lines: string[], recipeTitle = "", recipeAuthor = "") {
  const start = findIngredientsSectionStart(lines);
  return start >= 0 ? parseExplicitIngredients(lines, start) : parseImplicitIngredients(lines, recipeTitle, recipeAuthor);
}

function parseSocialIngredients(lines: string[], recipeTitle: string, recipeAuthor = "") {
  return parseImplicitIngredients(lines, recipeTitle, recipeAuthor);
}

function cleanMethodLine(value: string) {
  return stripMarkdown(value.trim())
    .replace(/\s*(?:See less|Ver menos)\s*$/i, "")
    .trim();
}

function isDecorativeSeparator(value: string) {
  const line = value.trim();
  return Boolean(line && !/[\p{L}\p{N}]/u.test(line));
}

function methodSectionLines(lines: string[]) {
  const explicitStart = findSectionStart(lines, SECTION_HEADINGS.method);
  const implicitStart = explicitStart < 0 ? findImplicitMethodStart(lines, -1) : -1;
  const start = explicitStart >= 0 ? explicitStart + 1 : implicitStart;
  if (start < 0) return [];
  const kept: string[] = [];

  for (let index = start; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const rawTrimmed = rawLine.trim();
    const headingLine = normalizedHeadingLine(rawLine);
    if (isHeading(rawLine, SECTION_HEADINGS.nutrition) || isMacroLine(rawLine)) break;
    if (/^#\w/.test(rawTrimmed)) break;
    const line = cleanMethodLine(rawLine);
    if (URL_LINE.test(line) || SOCIAL_FOOTER_LINE.test(cleanContentLine(line))) break;
    if (CREDIT_LINE.test(line) || UI_OR_JUNK_LINE.test(line)) continue;
    if (/^(?:did you make this|recipe tags?|ratings?|comments?|free\s+.+guide|comment\s+.+(?:link|recipe)|if you make it|cu[eé]ntame)\b/i.test(cleanContentLine(line))) break;
    if (isDecorativeSeparator(line)) {
      if (kept.some(Boolean)) break;
      continue;
    }
    if (isHeading(rawLine, SECTION_HEADINGS.ingredients) && kept.some(Boolean)) break;
    if (headingLine && /^(?:notes?|notas?|storage|conservaci[oó]n|trucos?|tips?)\s*:?$/i.test(headingLine) && kept.some(Boolean)) break;
    kept.push(line);
  }

  while (kept.length && !kept[kept.length - 1]) kept.pop();
  return kept;
}

type MethodMarker = { number: string | null; inlineBody: string } | null;

function methodMarker(value: string): MethodMarker {
  const step = value.match(/^\s*(?:step|paso)\s*(\d{1,2})\s*[:.)\-–—]?\s*(.*)$/i);
  if (step) return { number: step[1], inlineBody: step[2].trim() };

  const numbered = value.match(/^\s*(\d{1,2})[.)]\s*(.*)$/);
  if (numbered) return { number: numbered[1], inlineBody: numbered[2].trim() };

  const spacedNumber = value.match(/^\s*(\d{1,2})\s+(.+)$/);
  if (spacedNumber && looksLikeStepBody(spacedNumber[2])) {
    return { number: spacedNumber[1], inlineBody: spacedNumber[2].trim() };
  }

  const keycap = value.match(/^\s*([1-9])(?:\uFE0F?\u20E3)\s*(.*)$/);
  if (keycap) return { number: keycap[1], inlineBody: keycap[2].trim() };

  const bullet = value.match(/^\s*[-*•‣▪◦]\s*(.+)$/);
  if (bullet) return { number: null, inlineBody: bullet[1].trim() };

  return null;
}

function splitMarkedSteps(lines: string[]) {
  if (!lines.some((line) => methodMarker(line))) return [];

  const steps: { title: string; body: string }[] = [];
  let currentNumber: string | null = null;
  let currentParts: string[] = [];

  const flush = () => {
    const body = currentParts.join(" ").replace(/\s+/g, " ").trim();
    if (!body) return;
    steps.push({ title: `Step ${currentNumber || steps.length + 1}`, body });
    currentParts = [];
  };

  for (const line of lines) {
    if (!line) continue;
    const marker = methodMarker(line);
    if (marker) {
      flush();
      currentNumber = marker.number;
      if (marker.inlineBody) currentParts.push(marker.inlineBody);
      continue;
    }
    if (currentParts.length || currentNumber !== null) currentParts.push(line);
  }
  flush();
  return steps;
}

function parseMethod(lines: string[]) {
  const sectionLines = methodSectionLines(lines);
  if (!sectionLines.length) return [];

  const marked = splitMarkedSteps(sectionLines);
  if (marked.length) return marked;

  const paragraphs = sectionLines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs.map((body, index) => ({ title: `Step ${index + 1}`, body }));
  }

  const body = sectionLines.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return body ? [{ title: "Step 1", body }] : [];
}

function extractRange(source: string, labels: string[]): NutritionRange {
  const normalizedSource = stripMarkdown(source);
  const label = labels.join("|");
  const exact = normalizedSource.match(
    new RegExp(
      `(?:${label})\\s*:?\\s*(?:approximately\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(?:[–—-]\\s*(\\d+(?:[.,]\\d+)?))?`,
      "i",
    ),
  );

  if (!exact) return emptyRange();
  const min = exact[1].replace(",", ".");
  const max = (exact[2] || exact[1]).replace(",", ".");
  return { min, max };
}

function inferMainIngredients(title: string, ingredients: string[]) {
  const haystack = `${title} ${ingredients.join(" ")}`.toLowerCase();
  const candidates = [
    ["Salmon", /\bsalmon\b/],
    ["Chicken", /\bchicken\b|\bpollo\b/],
    ["Shrimp", /\bshrimp\b|\bprawns?\b|\bgambas?\b|\blangostinos?\b/],
    ["Beef", /\bbeef\b|\bternera\b/],
    ["Pinto beans", /\bpinto beans?\b/],
    ["Sweet Potato", /\bsweet potato\b|\bboniato\b/],
    ["Pasta", /\bpasta\b|\bspaghetti\b|\bpenne\b|\bfarfalle\b/],
    ["Bell pepper", /\bbell peppers?\b|\bpimientos?\b/],
    ["Lemon", /\blemon\b|\blim[oó]n\b/],
    ["Berries", /\bberries?\b|\bstrawberr(?:y|ies)\b|\bblueberr(?:y|ies)\b|\braspberr(?:y|ies)\b/],
    ["Milk", /\bmilk\b|\bleche\b/],
    ["Protein Powder", /\bprotein powder\b|\bwhey\b/],
  ] as const;

  return candidates
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([name]) => name)
    .slice(0, 5);
}

function inferMethods(source: string) {
  const lower = source.toLowerCase();
  const methods = [
    ["Slow Cooker", /\bslow cooker\b|\bcrockpot\b/],
    ["Grill", /\bgrill\b|\bgrilled\b/],
    ["Broiler", /\bbroil\b|\boven grill\b/],
    ["Oven", /\boven\b|\bbake\b|\broast\b/],
    ["Air Fryer", /\bair fry\b|\bair fryer\b/],
    ["Stovetop", /\bskillet\b|\bfrying pan\b|\bstovetop\b/],
    ["No Cook", /\bno cook\b/],
    ["Ninja Creami", /\bninja\s+creami\b|\bcreami\b/],
  ] as const;

  return methods.filter(([, pattern]) => pattern.test(lower)).map(([name]) => name);
}

function extractSocialAuthor(lines: string[], sourceType: string) {
  if (!SOCIAL_NETWORK_TYPES.has(sourceType)) return "";
  const headerEnd = findIngredientsSectionStart(lines);
  const searchEnd = headerEnd > 0 ? headerEnd : Math.min(lines.length, 40);

  for (let index = 0; index < searchEnd; index += 1) {
    if (!SOCIAL_PROFILE_ACTION_LINE.test(cleanLine(lines[index]))) continue;
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const candidate = cleanTitle(lines[previous]);
      if (!candidate || URL_LINE.test(candidate) || SOCIAL_SEPARATOR_LINE.test(candidate)) continue;
      if (candidate.length < 100) return candidate;
      break;
    }
  }

  return "";
}

function socialHeaderNoiseIndexes(lines: string[], sourceType: string) {
  const indexes = new Set<number>();
  if (!SOCIAL_NETWORK_TYPES.has(sourceType)) return indexes;
  const headerEnd = findIngredientsSectionStart(lines);
  const searchEnd = headerEnd > 0 ? headerEnd : Math.min(lines.length, 40);

  for (let index = 0; index < searchEnd; index += 1) {
    const line = cleanLine(lines[index]);
    if (SOCIAL_SEPARATOR_LINE.test(line) || SOCIAL_PROFILE_ACTION_LINE.test(line)) {
      indexes.add(index);
    }
    if (!SOCIAL_PROFILE_ACTION_LINE.test(line)) continue;
    for (let next = index + 1; next < searchEnd; next += 1) {
      const candidate = cleanLine(lines[next]);
      if (!candidate) continue;
      if (SOCIAL_AUDIO_LINE.test(candidate)) indexes.add(next);
      break;
    }
  }

  return indexes;
}

function extractTitle(lines: string[], sourceType = "", socialAuthor = "") {
  const ingredientsIndex = findIngredientsSectionStart(lines);
  const searchEnd = ingredientsIndex > 0 ? ingredientsIndex : Math.min(lines.length, 40);
  const ignoredIndexes = socialHeaderNoiseIndexes(lines, sourceType);

  for (let index = 0; index < searchEnd; index += 1) {
    if (ignoredIndexes.has(index)) continue;
    const line = cleanTitle(lines[index]);
    if (!line || URL_LINE.test(line) || isJunkLine(line)) continue;
    if (socialAuthor && line === socialAuthor) continue;
    if (SECTION_HEADINGS.ingredients.test(line) || SECTION_HEADINGS.method.test(line)) continue;
    if (/^(?:by\b|recipe by\b|original recipe\b|yield\b|servings?\b|serves\b|total time\b|prep time\b|cook time\b|time\b|published\b|updated\b|rating\b)/i.test(line)) continue;
    if (/^(?:\d+(?:\.\d+)?\s*(?:stars?|ratings?)|\d+\s+(?:minutes?|hours?)(?:\s+total)?)\s*$/i.test(line)) continue;
    if (line.length < 3 || line.length > 180) continue;
    return line;
  }

  return "";
}

function extractAuthor(lines: string[]) {
  for (const rawLine of lines.slice(0, 50)) {
    const line = cleanLine(rawLine);
    if (!line || CREDIT_LINE.test(line)) continue;
    const match = line.match(/^(?:recipe\s+by|by|original recipe\s*:?|receta\s+de|autor(?:a)?\s*:)[\s:]+(.+)$/i);
    if (!match) continue;
    const author = match[1]
      .replace(/\s*[|,]\s*(?:NYT Cooking|The New York Times).*$/i, "")
      .trim();
    if (author && author.length < 100) return author;
  }
  return "";
}

function extractContextualAuthor(lines: string[], title: string) {
  const useful = lines
    .slice(0, 30)
    .map((raw, index) => ({ raw, line: cleanContentLine(raw), index }))
    .filter((item) => item.line && !URL_LINE.test(item.line) && !isJunkLine(item.line));

  for (let position = 0; position < useful.length; position += 1) {
    const candidate = useful[position].line;
    if (!candidate || candidate === title || /\d/.test(candidate) || candidate.length > 70) continue;
    if (SECTION_HEADINGS.ingredients.test(candidate) || SECTION_HEADINGS.method.test(candidate)) continue;
    const next = useful[position + 1]?.line ?? "";
    const looksLikeRecipeMeta = /^(?:recipe\s*)?\(\s*\d+(?:[.,]\d+)?\s+(?:servings?|raciones?|porciones?)\s*\)\s*:?$/i.test(next) ||
      /^recipe\s*\(.*(?:servings?|raciones?|porciones?).*\)\s*:?$/i.test(next);
    const handle = /^@?[a-z0-9_.]{3,40}$/i.test(candidate);
    const name = /^[\p{L}'’.-]+(?:\s+[\p{L}'’.-]+){1,4}$/u.test(candidate);
    if (looksLikeRecipeMeta && (handle || name)) return candidate.replace(/^@/, "");
  }

  return "";
}

function extractServings(lines: string[]) {
  const normalized = normalizeText(lines.join("\n"));
  const patterns = [
    /(?:^|\n|\b)recipe\s*\(\s*(\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*\d+(?:[.,]\d+)?)?\s*(?:servings?|raciones?|porciones?)\s*\)\s*:?/i,
    /(?:^|\n|\b)ingredients?\s+(?:for\s+)?(?:about\s+)?(\d+(?:[.,]\d+)?)\s*(?:servings?|raciones?|porciones?)\b/i,
    /(?:^|\n|\b)(?:yield|servings?|serves|makes|raciones?|porciones?)[^\S\n]*:?[^\S\n]*x?[^\S\n]*(?:about[^\S\n]*)?(\d+(?:[.,]\d+)?)(?:[^\S\n]*[-–—][^\S\n]*\d+(?:[.,]\d+)?)?/i,
    /(?:^|\n)\s*(\d+(?:[.,]\d+)?)\s*(?:servings?|raciones?|porciones?)\b/i,
    /\b(\d+(?:[.,]\d+)?)\s*(?:raciones|porciones)\b/i,
    /(?:^|\n)\s*para\s+(\d+(?:[.,]\d+)?)\s+personas?\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].replace(",", ".");
  }
  return "";
}

function extractTime(lines: string[]) {
  const total = lineAfterHeading(lines, [/^total\s+time\s*:?/i, /^time\s*:?/i, /^tiempo(?:\s+total)?\s*:?/i]);
  if (total && /\d/.test(total)) return total;

  const normalized = normalizeText(lines.join("\n"));
  const inline = normalized.match(/(?:Total\s+Time|Time|Tiempo(?:\s+total)?)\s*:\s*([^\n]+)/i);
  if (inline?.[1] && /\d/.test(inline[1])) return inline[1].trim();
  return "";
}

function durationMinutes(value: string) {
  if (!value) return "";
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h|horas?)/i);
  const minutes = value.match(/(\d+(?:[.,]\d+)?)\s*(?:minutes?|mins?|min|m|minutos?)/i);
  const hourValue = hours ? Number.parseFloat(hours[1].replace(",", ".")) : 0;
  const minuteValue = minutes ? Number.parseFloat(minutes[1].replace(",", ".")) : 0;
  const total = Math.round(hourValue * 60 + minuteValue);
  return total > 0 ? String(total) : "";
}

function timePart(lines: string[], headings: RegExp[]) {
  return durationMinutes(lineAfterHeading(lines, headings));
}

function servingSuggestion(lines: string[]) {
  const start = findSectionStart(lines, SECTION_HEADINGS.serving);
  if (start < 0) return "";
  const ingredientsStart = findIngredientsSectionStart(lines);
  const methodStart = findSectionStart(lines, SECTION_HEADINGS.method);
  const implicitMethodStart = ingredientsStart >= 0 ? findImplicitMethodStart(lines, ingredientsStart) : -1;
  const ingredientBoundary = methodStart >= 0 ? methodStart : implicitMethodStart;
  if (ingredientsStart >= 0 && start > ingredientsStart && (ingredientBoundary < 0 || start < ingredientBoundary)) {
    return "";
  }
  const end = findSectionEnd(lines, start, [SECTION_HEADINGS.nutrition]);
  return lines
    .slice(start + 1, end)
    .map(cleanLine)
    .filter((line) => line && !isJunkLine(line) && !URL_LINE.test(line))
    .join("\n\n");
}

export function parseRecipe(raw: string, context: PasteContext = {}): ParsedRecipe {
  const initiallyNormalized = normalizeText(raw);
  const sourceUrl = normalizeSourceUrl(context.sourceUrl || extractSourceUrl(initiallyNormalized));
  const sourceType = sourceTypeFromUrl(sourceUrl);
  const normalized = expandCompactSocialPaste(initiallyNormalized, sourceType, sourceUrl);
  const lines = normalized.split("\n");
  const publicationFromUrl = sourceFromUrl(sourceUrl);
  const publicationFromText = /\bNYT Cooking\b/i.test(normalized)
    ? "NYT Cooking"
    : /\bThe New York Times\b/i.test(normalized)
      ? "The New York Times"
      : "";
  const socialAuthor = extractSocialAuthor(lines, sourceType);
  const title = extractTitle(lines, sourceType, socialAuthor);
  const author = extractAuthor(lines) || socialAuthor || extractContextualAuthor(lines, title);
  const ingredients = parseIngredients(lines, title, author);
  const finalIngredients = ingredients.length ? ingredients : parseSocialIngredients(lines, title, author);
  const imageUrl = context.imageUrl?.trim() || "";

  return {
    title,
    summary: "",
    author,
    publication: publicationFromUrl || publicationFromText,
    sourceType,
    sourceUrl,
    imageUrl,
    imageStatus: imageUrl ? "found_clipboard" : "missing",
    imageWarning: "",
    servings: extractServings(lines),
    time: extractTime(lines),
    prepMinutes: timePart(lines, [/^prep(?:aration)?\s+time\s*:?/i, /^tiempo\s+de\s+preparaci[oó]n\s*:?/i]),
    cookMinutes: timePart(lines, [/^cook(?:ing)?\s+time\s*:?/i, /^tiempo\s+de\s+cocci[oó]n\s*:?/i]),
    restingMinutes: timePart(lines, [/^rest(?:ing)?\s+time\s*:?/i, /^reposo\s*:?/i]),
    marinatingMinutes: timePart(lines, [/^marinat(?:ing|ion)\s+time\s*:?/i, /^marinado\s*:?/i]),
    totalMinutes: durationMinutes(extractTime(lines)),
    ingredients: finalIngredients,
    method: parseMethod(lines),
    calories: extractRange(normalized, ["Calories", "Calorías"]),
    protein: extractRange(normalized, ["Protein", "Proteína"]),
    carbs: extractRange(normalized, ["Carbohydrates", "Carbs", "Hidratos"]),
    fat: extractRange(normalized, ["Fat", "Grasa"]),
    fiber: extractRange(normalized, ["Fiber", "Fibre", "Fibra"]),
    servingSuggestion: servingSuggestion(lines),
    mainIngredients: inferMainIngredients(title, finalIngredients),
    dish: [],
    formats: [],
    mealTypes: [],
    methods: inferMethods(normalized),
    cuisines: [],
    collections: [],
    publicNotes: "",
  };
}

function getHtmlAttribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeBasicEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function imageScore(url: string, alt: string) {
  const lower = `${url} ${alt}`.toLowerCase();
  if (!/^https?:\/\//i.test(url)) return -100;
  if (/logo|icon|avatar|profile|sprite|tracking|pixel|badge/.test(lower)) return -100;
  let score = 0;
  if (/nyt\.com\/images|static01\.nyt\.com|nytimg\.com/.test(lower)) score += 80;
  if (/recipe|food|cooking/.test(lower)) score += 30;
  if (/w=\d{3,}|width=\d{3,}/.test(lower)) score += 10;
  return score;
}

export function extractPasteContextFromHtml(html: string): PasteContext {
  if (!html) return {};
  const urls: string[] = [];
  const images: { url: string; alt: string; score: number }[] = [];

  for (const tag of html.match(/<a\b[^>]*>/gi) ?? []) {
    const href = getHtmlAttribute(tag, "href");
    if (/^https?:\/\//i.test(href)) urls.push(normalizeSourceUrl(href));
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const src = getHtmlAttribute(tag, "src") || getHtmlAttribute(tag, "data-src");
    const srcset = getHtmlAttribute(tag, "srcset");
    const alt = getHtmlAttribute(tag, "alt");
    const candidates = [src, ...srcset.split(",").map((item) => item.trim().split(/\s+/)[0])].filter(Boolean);
    for (const candidate of candidates) {
      images.push({ url: candidate, alt, score: imageScore(candidate, alt) });
    }
  }

  const sourceUrl = Array.from(new Set(urls)).sort((a, b) => urlScore(b) - urlScore(a))[0] ?? "";
  const imageUrl = images.sort((a, b) => b.score - a.score)[0];

  return {
    sourceUrl,
    imageUrl: imageUrl && imageUrl.score >= 0 ? imageUrl.url : "",
  };
}
