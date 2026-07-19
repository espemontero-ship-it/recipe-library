export type NutritionRange = {
  min: string;
  max: string;
};

export type ParsedRecipe = {
  title: string;
  author: string;
  publication: string;
  sourceUrl: string;
  imageUrl: string;
  imageStatus: "found_clipboard" | "found_source" | "missing";
  imageWarning: string;
  servings: string;
  time: string;
  ingredients: string[];
  method: { title: string; body: string }[];
  calories: NutritionRange;
  protein: NutritionRange;
  carbs: NutritionRange;
  fat: NutritionRange;
  fiber: NutritionRange;
  servingSuggestion: string;
  mainIngredients: string[];
  methods: string[];
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
  ingredients: /^(?:ingredients?|ingredientes?)\s*:?$/i,
  method: /^(?:preparation|method|directions?|instructions?|steps?|preparaci[oó]n|m[eé]todo|elaboraci[oó]n|instrucciones?)\s*:?$/i,
  nutrition: /^(?:approximate\s+)?(?:nutrition|nutrici[oó]n|macros?)\s*:?$/i,
  serving: /^(?:serving suggestion|to serve|sugerencia de servicio)\s*:?$/i,
};

const UI_OR_JUNK_LINE = /^(?:save|saved|print|share|email|copy link|rate|rating|ratings|comments?|read more|see less|ver menos|add to your grocery list|ingredient substitution guide|private notes?|unlock this recipe|subscribe|sign in|log in|view recipe|featured recipe|advertisement|skip advertisement)\b/i;
const CREDIT_LINE = /(?:\bcredit\b|\bphoto(?:graph)?\s*(?:by|:)|\bfood stylist\b|\bprop stylist\b|\bstyled by\b|\bphotographer\b)/i;
const NYT_NAV_OR_META_LINE = /^(?:recipes?|occasions|articles|about|give|published\s+.+|updated\s+.+|media\s+\d+\s+of\s+\d+|read\s+\d[\d,.]*\s+comments?|\(?\d[\d,.]*\)?|total time|prep time|cook time)$/i;
const URL_LINE = /^https?:\/\/\S+$/i;

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
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
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
  return pattern.test(cleanLine(value));
}

function findSectionStart(lines: string[], pattern: RegExp) {
  return lines.findIndex((line) => isHeading(line, pattern));
}

function isServingsLine(value: string) {
  return /^(?:(?:yield|servings?|serves|makes|raciones?)\s*:?\s*(?:about\s*)?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s+(?:servings?|raciones?))$/i.test(
    cleanLine(value),
  );
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
  const line = cleanLine(value);
  if (!line || isJunkLine(line) || URL_LINE.test(line)) return false;
  if (/^(?:yield|servings?|serves|makes|time|total time|prep time|cook time|recipe by|by|original recipe)\b/i.test(line)) {
    return false;
  }

  return /^(?:\(?\d+(?:[.,]\d+)?(?:\s*[¼½¾⅓⅔⅛⅜⅝⅞])?|[¼½¾⅓⅔⅛⅜⅝⅞]|one\b|two\b|three\b|four\b|five\b|six\b|a\s+(?:pinch|dash|handful)\b|pinch\b|dash\b|salt\b|pepper\b|cooking spray\b)/i.test(line);
}

function looksLikeIngredientSubheading(value: string) {
  const line = cleanLine(value);
  if (!line || isJunkLine(line) || isIngredientLikeLine(line)) return false;
  if (line.length > 60 || /[.!?]$/.test(line)) return false;
  return /^(?:for\b|to serve\b|for serving\b|optional\b|garnish\b|sauce\b|marinade\b)/i.test(line) || /:$/.test(line);
}

function parseIngredients(lines: string[]) {
  const start = findIngredientsSectionStart(lines);
  if (start < 0) return [];
  const end = findSectionEnd(lines, start, [SECTION_HEADINGS.method, SECTION_HEADINGS.nutrition, SECTION_HEADINGS.serving]);
  const section = lines.slice(start + 1, end);
  const ingredients: string[] = [];

  for (const rawLine of section) {
    const line = cleanLine(rawLine);
    if (!line || isJunkLine(line) || URL_LINE.test(line)) continue;
    if (isServingsLine(line) || /^(?:yield|servings?|serves|makes)\s*:?/i.test(line)) continue;
    if (/^(?:ingredient checklist|ingredient substitution guide)$/i.test(line)) continue;

    if (looksLikeIngredientSubheading(line)) {
      ingredients.push(line.replace(/:$/, "") + ":");
      continue;
    }

    if (isIngredientLikeLine(line) || (line.length <= 220 && !/[.!?]$/.test(line))) {
      ingredients.push(line);
    }
  }

  return ingredients;
}

function parseSocialIngredients(lines: string[]) {
  const ingredients: string[] = [];
  let started = false;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (SECTION_HEADINGS.method.test(line) || SECTION_HEADINGS.nutrition.test(line)) {
      if (started) break;
      continue;
    }
    if (/^#\w/.test(line) || /^(?:see less|ver menos)$/i.test(line)) {
      if (started) break;
      continue;
    }
    if (isIngredientLikeLine(line)) {
      started = true;
      ingredients.push(line);
      continue;
    }
    if (started && looksLikeIngredientSubheading(line)) {
      ingredients.push(line.replace(/:$/, "") + ":");
      continue;
    }
    if (started) break;
  }

  return ingredients;
}

function methodSectionText(lines: string[]) {
  const start = findSectionStart(lines, SECTION_HEADINGS.method);
  if (start < 0) return "";
  const end = findSectionEnd(lines, start, [SECTION_HEADINGS.nutrition, SECTION_HEADINGS.serving]);
  const kept: string[] = [];

  for (const rawLine of lines.slice(start + 1, end)) {
    const line = cleanLine(rawLine);
    if (URL_LINE.test(line)) break;
    if (CREDIT_LINE.test(line) || UI_OR_JUNK_LINE.test(line)) continue;
    if (/^(?:did you make this|recipe tags?|ratings?|comments?)\b/i.test(line)) break;
    kept.push(line);
  }

  return kept.join("\n").trim();
}

function splitMarkedSteps(value: string) {
  const patterns = [
    /(?:^|\n)\s*(?:step|paso)\s*(\d{1,2})\s*[:.)\-–—]?\s*/gi,
    /(?:^|\n)\s*(\d{1,2})[.)]\s+/g,
    /(?:^|\n)\s*([1-9])(?:\uFE0F?\u20E3)\s*/g,
  ];

  for (const pattern of patterns) {
    const matches = Array.from(value.matchAll(pattern));
    if (!matches.length) continue;

    const steps = matches
      .map((match, index) => {
        const start = (match.index ?? 0) + match[0].length;
        const end = matches[index + 1]?.index ?? value.length;
        const body = value.slice(start, end).replace(/^\s*[:.\-–—]\s*/, "").trim();
        return {
          title: `Step ${match[1] || index + 1}`,
          body: body.replace(/\n{3,}/g, "\n\n"),
        };
      })
      .filter((step) => step.body);

    if (steps.length) return steps;
  }

  return [];
}

function parseMethod(lines: string[]) {
  const section = methodSectionText(lines);
  if (!section) return [];

  const marked = splitMarkedSteps(section);
  if (marked.length) return marked;

  const paragraphs = section
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs.map((body, index) => ({ title: `Step ${index + 1}`, body }));
  }

  return section ? [{ title: "Step 1", body: section.replace(/\n+/g, " ") }] : [];
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

function extractTitle(lines: string[]) {
  const ingredientsIndex = findIngredientsSectionStart(lines);
  const searchLines = ingredientsIndex > 0 ? lines.slice(0, ingredientsIndex) : lines.slice(0, 40);

  for (const rawLine of searchLines) {
    const line = cleanTitle(rawLine);
    if (!line || URL_LINE.test(line) || isJunkLine(line)) continue;
    if (SECTION_HEADINGS.ingredients.test(line) || SECTION_HEADINGS.method.test(line)) continue;
    if (/^(?:by\b|recipe by\b|original recipe\b|yield\b|servings?\b|serves\b|total time\b|prep time\b|cook time\b|time\b|published\b|updated\b|rating\b)/i.test(line)) continue;
    if (/^(?:\d+(?:\.\d+)?\s*(?:stars?|ratings?)|\d+\s+minutes?|\d+\s+hours?)/i.test(line)) continue;
    if (line.length < 3 || line.length > 180) continue;
    return line;
  }

  return "";
}

function extractAuthor(lines: string[]) {
  for (const rawLine of lines.slice(0, 50)) {
    const line = cleanLine(rawLine);
    if (!line || CREDIT_LINE.test(line)) continue;
    const match = line.match(/^(?:recipe\s+by|by|original recipe\s*:?)[\s:]+(.+)$/i);
    if (!match) continue;
    const author = match[1]
      .replace(/\s*[|,]\s*(?:NYT Cooking|The New York Times).*$/i, "")
      .trim();
    if (author && author.length < 100) return author;
  }
  return "";
}

function extractServings(lines: string[]) {
  const normalized = normalizeText(lines.join("\n"));
  const numberFirst = normalized.match(/(?:^|\n)\s*(\d+(?:[.,]\d+)?)\s+(?:servings?|raciones?)\s*(?:\n|$)/i);
  if (numberFirst) return numberFirst[1].replace(",", ".");

  const direct = normalized.match(
    /(?:^|\n)\s*(?:Yield|Servings?|Serves|Makes|Raciones?)\s*:?\s*(?:about\s*)?(\d+(?:[.,]\d+)?)\s*(?:servings?|raciones?)?\s*(?:\n|$)/i,
  );
  if (direct) return direct[1].replace(",", ".");

  const ingredientsStart = findIngredientsSectionStart(lines);
  if (ingredientsStart >= 0) {
    for (const rawLine of lines.slice(ingredientsStart + 1, ingredientsStart + 6)) {
      const line = cleanLine(rawLine);
      const match = line.match(/^(\d+(?:[.,]\d+)?)\s+(?:servings?|raciones?)$/i);
      if (match) return match[1].replace(",", ".");
    }
  }

  const after = lineAfterHeading(lines, [/^(?:yield|servings?|serves|makes|raciones?)\s*:?/i]);
  const number = after.match(/\d+(?:[.,]\d+)?/);
  return number?.[0]?.replace(",", ".") ?? "";
}

function extractTime(lines: string[]) {
  const total = lineAfterHeading(lines, [/^total\s+time\s*:?/i, /^time\s*:?/i, /^tiempo(?:\s+total)?\s*:?/i]);
  if (total && /\d/.test(total)) return total;

  const normalized = normalizeText(lines.join("\n"));
  const inline = normalized.match(/(?:Total\s+Time|Time|Tiempo(?:\s+total)?)\s*:\s*([^\n]+)/i);
  if (inline?.[1] && /\d/.test(inline[1])) return inline[1].trim();
  return "";
}

function servingSuggestion(lines: string[]) {
  const start = findSectionStart(lines, SECTION_HEADINGS.serving);
  if (start < 0) return "";
  const end = findSectionEnd(lines, start, [SECTION_HEADINGS.nutrition]);
  return lines
    .slice(start + 1, end)
    .map(cleanLine)
    .filter((line) => line && !isJunkLine(line) && !URL_LINE.test(line))
    .join("\n\n");
}

export function parseRecipe(raw: string, context: PasteContext = {}): ParsedRecipe {
  const normalized = normalizeText(raw);
  const lines = normalized.split("\n");
  const sourceUrl = normalizeSourceUrl(context.sourceUrl || extractSourceUrl(normalized));
  const publicationFromUrl = sourceFromUrl(sourceUrl);
  const publicationFromText = /\bNYT Cooking\b/i.test(normalized)
    ? "NYT Cooking"
    : /\bThe New York Times\b/i.test(normalized)
      ? "The New York Times"
      : "";
  const title = extractTitle(lines);
  const ingredients = parseIngredients(lines);
  const finalIngredients = ingredients.length ? ingredients : parseSocialIngredients(lines);
  const imageUrl = context.imageUrl?.trim() || "";

  return {
    title,
    author: extractAuthor(lines),
    publication: publicationFromUrl || publicationFromText,
    sourceUrl,
    imageUrl,
    imageStatus: imageUrl ? "found_clipboard" : "missing",
    imageWarning: "",
    servings: extractServings(lines),
    time: extractTime(lines),
    ingredients: finalIngredients,
    method: parseMethod(lines),
    calories: extractRange(normalized, ["Calories", "Calorías"]),
    protein: extractRange(normalized, ["Protein", "Proteína"]),
    carbs: extractRange(normalized, ["Carbohydrates", "Carbs", "Hidratos"]),
    fat: extractRange(normalized, ["Fat", "Grasa"]),
    fiber: extractRange(normalized, ["Fiber", "Fibre", "Fibra"]),
    servingSuggestion: servingSuggestion(lines),
    mainIngredients: inferMainIngredients(title, finalIngredients),
    methods: inferMethods(normalized),
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
