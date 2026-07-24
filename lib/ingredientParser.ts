import {
  createEntityId,
  RecipeIngredient,
} from "@/lib/recipeModel";

const FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅐": 1 / 7,
  "⅑": 1 / 9,
  "⅒": 0.1,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  half: 0.5,
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  medio: 0.5,
  media: 0.5,
};

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  grs: "g",
  gram: "g",
  grams: "g",
  gramo: "g",
  gramos: "g",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  mg: "mg",
  ml: "ml",
  cl: "cl",
  dl: "dl",
  l: "l",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  litro: "l",
  litros: "l",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cucharadita: "tsp",
  cucharaditas: "tsp",
  cdita: "tsp",
  cditas: "tsp",
  cdta: "tsp",
  cdtas: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cucharada: "tbsp",
  cucharadas: "tbsp",
  cda: "tbsp",
  cdas: "tbsp",
  cup: "cup",
  cups: "cup",
  taza: "cup",
  tazas: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  onza: "oz",
  onzas: "oz",
  "fl oz": "fl_oz",
  "fluid ounce": "fl_oz",
  "fluid ounces": "fl_oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  libra: "lb",
  libras: "lb",
  clove: "clove",
  cloves: "clove",
  diente: "clove",
  dientes: "clove",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  lata: "can",
  latas: "can",
  bag: "package",
  bags: "package",
  bolsa: "package",
  bolsas: "package",
  tub: "package",
  tubs: "package",
  bote: "package",
  botes: "package",
  scoop: "scoop",
  scoops: "scoop",
  cacito: "scoop",
  cacitos: "scoop",
  wrapper: "piece",
  wrappers: "piece",
  package: "package",
  packages: "package",
  packet: "package",
  packets: "package",
  paquete: "package",
  paquetes: "package",
  sobre: "package",
  sobres: "package",
  slice: "slice",
  slices: "slice",
  loncha: "slice",
  lonchas: "slice",
  piece: "piece",
  pieces: "piece",
  unidad: "piece",
  unidades: "piece",
  bunch: "bunch",
  bunches: "bunch",
  manojo: "bunch",
  manojos: "bunch",
  pinch: "pinch",
  pinches: "pinch",
  pizca: "pinch",
  pizcas: "pinch",
};

const UNIT_KEYS = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const UNIT_PATTERN = UNIT_KEYS
  .map((value) => escapeRegex(value).replace(/\s+/g, "\\s+"))
  .join("|");
const UNIT_REGEX = new RegExp(`^(${UNIT_PATTERN})(?:\\.)?(?=\\s|[,;:()\\-–—/]|$)\\s*`, "iu");

const WEIGHT_UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  gramo: "g",
  gramos: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  onza: "oz",
  onzas: "oz",
  lb: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  l: "l",
};
const WEIGHT_UNIT_PATTERN = Object.keys(WEIGHT_UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");
const PACKAGE_UNIT_PATTERN = "cans?|tins?|latas?|packages?|packets?|paquetes?|sobres?";
const MODIFIER_PATTERN = "packed|heaped|level|rounded|big|small|medium|large|colmadas?|rasas?|generosas?|grandes?|pequeñas?|pequenos?|medianas?";

export function parseSimpleNumber(value: string) {
  const normalized = value.trim().toLowerCase().replace(",", ".");
  if (!normalized) return null;

  if (WORD_NUMBERS[normalized] !== undefined) return WORD_NUMBERS[normalized];
  if (FRACTIONS[normalized] !== undefined) return FRACTIONS[normalized];

  const mixedUnicode = normalized.match(/^(\d+)\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (mixedUnicode) return Number(mixedUnicode[1]) + FRACTIONS[mixedUnicode[2]];

  const fraction = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction && Number(fraction[2])) return Number(fraction[1]) / Number(fraction[2]);

  const mixed = normalized.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed && Number(mixed[3])) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

const UNICODE_FRACTIONS = "¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞";
const WORD_NUMBER_PATTERN = Object.keys(WORD_NUMBERS)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");
const QUANTITY_TOKEN = [
  `\\d+\\s+\\d+\\s*\\/\\s*\\d+`,
  `\\d+\\s*[${UNICODE_FRACTIONS}]`,
  `\\d+\\s*\\/\\s*\\d+`,
  `\\d+(?:[.,]\\d+)?`,
  `[${UNICODE_FRACTIONS}]`,
  `(?:${WORD_NUMBER_PATTERN})\\b`,
].join("|");
const LEADING_QUANTITY_REGEX = new RegExp(
  `^\\s*(${QUANTITY_TOKEN})(?:\\s*(?:-|–|—|to|a)\\s*(${QUANTITY_TOKEN}))?`,
  "iu",
);

function extractLeadingQuantity(value: string) {
  const match = value.match(LEADING_QUANTITY_REGEX);
  if (!match) return { min: null, max: null, rest: value.trim() };

  const min = parseSimpleNumber(match[1]);
  const max = parseSimpleNumber(match[2] ?? match[1]);
  return {
    min,
    max: max ?? min,
    rest: value.slice(match[0].length).trim(),
  };
}

function normalizeUnitToken(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

function extractUnit(value: string) {
  const match = value.match(UNIT_REGEX);
  if (!match) return { unit: null, rest: value.trim() };
  const unit = UNIT_ALIASES[normalizeUnitToken(match[1])] ?? null;
  return unit
    ? { unit, rest: value.slice(match[0].length).trim() }
    : { unit: null, rest: value.trim() };
}

function normalizeWeight(value: string, rawUnit: string) {
  const amount = value.replace(",", ".");
  const unit = WEIGHT_UNIT_ALIASES[normalizeUnitToken(rawUnit)] ?? normalizeUnitToken(rawUnit);
  return `${amount} ${unit}`;
}

function stripIngredientConnector(value: string) {
  return value
    .replace(/^\s*(?:de(?:l)?|of)\s+/i, "")
    .replace(/^\s*[-–—]\s*/, "")
    .trim();
}

function splitTopLevelComma(value: string) {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);
    if (character === "," && depth === 0) {
      return [value.slice(0, index), value.slice(index + 1)] as const;
    }
  }
  return [value, ""] as const;
}

function parsePackageWeightPrefix(value: string) {
  const xWeight = value.match(
    new RegExp(`^x\\s*(\\d+(?:[.,]\\d+)?)\\s*(${WEIGHT_UNIT_PATTERN})\\s+(${PACKAGE_UNIT_PATTERN})\\b\\s*`, "iu"),
  );
  if (xWeight) {
    const packageUnit = UNIT_ALIASES[normalizeUnitToken(xWeight[3])] ?? "package";
    return {
      unit: packageUnit,
      note: `${normalizeWeight(xWeight[1], xWeight[2])} each`,
      rest: value.slice(xWeight[0].length).trim(),
    };
  }

  const hyphenWeight = value.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*[-–—]\\s*(${WEIGHT_UNIT_PATTERN})\\s+(${PACKAGE_UNIT_PATTERN})\\b\\s*`, "iu"),
  );
  if (hyphenWeight) {
    const packageUnit = UNIT_ALIASES[normalizeUnitToken(hyphenWeight[3])] ?? "package";
    return {
      unit: packageUnit,
      note: normalizeWeight(hyphenWeight[1], hyphenWeight[2]),
      rest: value.slice(hyphenWeight[0].length).trim(),
    };
  }

  return null;
}

function extractParentheticalWeight(value: string, appendEach: boolean) {
  const match = value.match(
    new RegExp(`^\\(\\s*(\\d+(?:[.,]\\d+)?)\\s*(${WEIGHT_UNIT_PATTERN})\\s*\\)\\s*`, "iu"),
  );
  if (!match) return null;
  return {
    note: `${normalizeWeight(match[1], match[2])}${appendEach ? " each" : ""}`,
    rest: value.slice(match[0].length).trim(),
  };
}

function joinNotes(...values: Array<string | null | undefined>) {
  const notes = values.map((value) => value?.trim()).filter(Boolean) as string[];
  return notes.length ? notes.join(", ") : null;
}

export function parseIngredientLine(originalLine: string): RecipeIngredient {
  const clean = originalLine
    .replace(/^\s*(?:(?:[-*•‣▪◦✅✔☑✳❇]\uFE0F?)|(?:[\p{Extended_Pictographic}]\uFE0F?))+\s*/u, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\u2044/g, "/")
    .replace(/^(\d+\s*\/\s*\d+)(?:st|nd|rd|th)\b/i, "$1")
    .replace(/^(?:unas?|unos?|about|approximately)\s+(?=\d|[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstComma = clean.indexOf(",");
  if (firstComma > 0 && !/^\d+$/.test(clean.slice(0, firstComma).trim())) {
    const ingredientName = clean.slice(0, firstComma).trim();
    const measurementText = clean.slice(firstComma + 1).trim();
    const trailingQuantity = extractLeadingQuantity(measurementText);
    if (trailingQuantity.min !== null) {
      const trailingUnit = extractUnit(trailingQuantity.rest);
      if (trailingUnit.unit || !trailingUnit.rest || /^,/.test(trailingUnit.rest)) {
        const note = trailingUnit.rest.replace(/^,\s*/, "").trim() || null;
        return {
          id: createEntityId("ingredient"),
          originalLine: clean,
          parseStatus: ingredientName ? "confirmed" : "review",
          canonicalIngredient: ingredientName || null,
          quantity: { min: trailingQuantity.min, max: trailingQuantity.max },
          unit: trailingUnit.unit,
          preparationNote: note,
          optional: /\boptional\b|\bopcional\b/i.test(clean),
          garnish: /\bfor garnish\b|\bpara decorar\b/i.test(clean),
          servingAccompaniment: /\bto serve\b|\bpara servir\b/i.test(clean),
          nutrition: {
            status: "pending",
            fdcId: null,
            foodName: null,
            brandName: null,
            grams: null,
            per100g: null,
            note: null,
          },
        };
      }
    }
  }

  const quantity = extractLeadingQuantity(clean);
  let rest = quantity.rest;
  let unit: string | null = null;
  let structuralNote: string | null = null;
  let modifierNote: string | null = null;

  const packageWeight = parsePackageWeightPrefix(rest);
  if (packageWeight) {
    unit = packageWeight.unit;
    structuralNote = packageWeight.note;
    rest = packageWeight.rest;
  } else {
    const modifier = rest.match(new RegExp(`^(${MODIFIER_PATTERN})\\s+`, "iu"));
    if (modifier) {
      modifierNote = modifier[1].toLowerCase();
      rest = rest.slice(modifier[0].length).trim();
    }

    const extractedUnit = extractUnit(rest);
    unit = extractedUnit.unit;
    rest = extractedUnit.rest;

    const parenthetical = extractParentheticalWeight(rest, unit === null);
    if (parenthetical) {
      structuralNote = parenthetical.note;
      rest = parenthetical.rest;
    }
  }

  rest = stripIngredientConnector(rest);
  const [ingredientPart, commaNote] = splitTopLevelComma(rest);
  const canonicalIngredient = ingredientPart.trim() || rest.trim() || null;
  const preparationNote = joinNotes(structuralNote, modifierNote, commaNote);

  return {
    id: createEntityId("ingredient"),
    originalLine: clean,
    parseStatus: canonicalIngredient ? "confirmed" : "review",
    canonicalIngredient,
    quantity: { min: quantity.min, max: quantity.max },
    unit,
    preparationNote,
    optional: /\boptional\b|\bopcional\b/i.test(clean),
    garnish: /\bfor garnish\b|\bpara decorar\b/i.test(clean),
    servingAccompaniment: /\bto serve\b|\bpara servir\b/i.test(clean),
    nutrition: {
      status: "pending",
      fdcId: null,
      foodName: null,
      brandName: null,
      grams: null,
      per100g: null,
      note: null,
    },
  };
}

export function ingredientDisplayLine(item: RecipeIngredient) {
  const quantity = item.quantity.min === null
    ? ""
    : item.quantity.max !== null && item.quantity.max !== item.quantity.min
      ? `${item.quantity.min}–${item.quantity.max}`
      : `${item.quantity.min}`;
  return [quantity, item.unit, item.canonicalIngredient, item.preparationNote]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
