"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  FileText,
  Loader2,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import styles from "./paste.module.css";
import { createAndSaveRecipe } from "@/lib/browserRecipeStorage";
import { AdminGate } from "@/components/AdminGate";

type NutritionRange = {
  min: string;
  max: string;
};

type ParsedRecipe = {
  title: string;
  author: string;
  publication: string;
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

type Confidence = "confirmed" | "review" | "missing";

type ReviewField = {
  label: string;
  confidence: Confidence;
};

const SAMPLE_RECIPE = `# Salmon with Lemon-Herb Marinade

**Original recipe:** Moira Hodgson, *The New York Times*
**Servings:** 6
**Time:** 20 minutes, plus at least 1 hour marinating

## Ingredients

* 1 whole salmon fillet, approximately **1.36 kg**
* 1 garlic clove, finely minced
* **25 g** dark brown sugar
* **30 ml** soy sauce
* **6 g** finely grated lemon zest
* **8 g** fresh parsley, finely chopped
* **4 g** fresh thyme leaves
* **3 g** fresh rosemary leaves, finely chopped
* **15 ml** fresh lemon juice
* **30 ml** sesame oil
* **60 ml** extra-virgin olive oil
* Coarse salt and freshly ground black pepper, to taste
* 1 lemon, cut into 6 wedges
* Fresh rosemary sprigs, for garnish

## Method

### 1. Prepare the marinade

Pat the salmon dry with kitchen paper.

In a small bowl, combine the garlic, brown sugar, soy sauce, lemon zest, parsley, thyme, rosemary, lemon juice, sesame oil and olive oil. Season with salt and black pepper.

### 2. Marinate the salmon

Place the salmon in a large dish and pour the marinade over it, making sure the fish is well coated on both sides.

Cover and refrigerate for at least **1 hour**.

### 3. Cook

Preheat the oven grill or an outdoor grill.

Cook the salmon for approximately **5–6 minutes per side**, turning it once. The centre should remain moist and slightly pink.

### 4. Serve

Transfer the salmon to a serving platter and garnish with the lemon wedges and fresh rosemary sprigs.

## Approximate Nutrition

Per serving, based on 6 servings and assuming that some of the marinade remains in the dish:

* **Calories:** approximately 540–565 kcal
* **Protein:** approximately 47 g
* **Carbohydrates:** approximately 4–5 g
* **Fat:** approximately 36–39 g
* **Fibre:** approximately 0.3 g

## Serving Suggestion

Serve with green salad, grilled asparagus, roasted vegetables or a sharp potato salad with yoghurt and horseradish dressing.`;

const emptyRange = (): NutritionRange => ({ min: "", max: "" });

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

function cleanLine(value: string) {
  return stripMarkdown(value.replace(/^[-*•]\s*/, "").trim());
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

function findSection(
  lines: string[],
  startPatterns: RegExp[],
  endPatterns: RegExp[],
) {
  const start = lines.findIndex((line) =>
    startPatterns.some((pattern) => pattern.test(stripMarkdown(line))),
  );

  if (start < 0) return [];

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (endPatterns.some((pattern) => pattern.test(stripMarkdown(lines[index])))) {
      end = index;
      break;
    }
  }

  return lines.slice(start + 1, end);
}

function parseMethod(lines: string[]) {
  const section = findSection(
    lines,
    [/^method$/i, /^directions?$/i, /^instructions?$/i, /^preparation$/i],
    [/^approximate nutrition$/i, /^nutrition$/i, /^serving suggestion$/i, /^notes?$/i],
  );

  if (!section.length) return [];

  const steps: { title: string; body: string }[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const rawLine of section) {
    const line = stripMarkdown(rawLine).trim();
    if (!line) continue;

    const heading = line.match(/^(?:\d+[.)]\s*)?(.+)$/);
    const wasMarkdownHeading = /^###\s+/.test(rawLine.trim());

    if (wasMarkdownHeading) {
      if (current !== null) {
        steps.push({
          title: current.title,
          body: current.body.join("\n\n").trim(),
        });
      }
      current = {
        title: heading?.[1]?.replace(/^\d+[.)]\s*/, "").trim() || "Step",
        body: [],
      };
      continue;
    }

    if (current === null) {
      current = { title: "Method", body: [] };
    }
    current.body.push(line);
  }

  if (current) {
    steps.push({
      title: current.title,
      body: current.body.join("\n\n").trim(),
    });
  }

  return steps.filter((step) => step.title || step.body);
}

function inferMainIngredients(title: string, ingredients: string[]) {
  const haystack = `${title} ${ingredients.join(" ")}`.toLowerCase();
  const candidates = [
    ["Salmon", /\bsalmon\b/],
    ["Chicken", /\bchicken\b|\bpollo\b/],
    ["Shrimp", /\bshrimp\b|\bprawns?\b|\bgambas?\b|\blangostinos?\b/],
    ["Beef", /\bbeef\b|\bternera\b/],
    ["Sweet Potato", /\bsweet potato\b|\bboniato\b/],
    ["Pasta", /\bpasta\b|\bspaghetti\b|\bpenne\b|\bfarfalle\b/],
    ["Lemon", /\blemon\b|\blim[oó]n\b/],
    ["Fresh Herbs", /\bparsley\b|\bthyme\b|\brosemary\b|\bcilantro\b/],
  ] as const;

  return candidates
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([name]) => name)
    .slice(0, 5);
}

function inferMethods(source: string) {
  const lower = source.toLowerCase();
  const methods = [
    ["Grill", /\bgrill\b|\bgrilled\b/],
    ["Broiler", /\bbroil\b|\boven grill\b/],
    ["Oven", /\boven\b|\bbake\b|\broast\b/],
    ["Air Fryer", /\bair fry\b|\bair fryer\b/],
    ["Stovetop", /\bskillet\b|\bfrying pan\b|\bstovetop\b/],
    ["No Cook", /\bno cook\b/],
  ] as const;

  return methods
    .filter(([, pattern]) => pattern.test(lower))
    .map(([name]) => name);
}

function parseRecipe(raw: string): ParsedRecipe {
  const lines = raw.replace(/\r/g, "").split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);

  const titleLine =
    nonEmpty.find((line) => /^#\s+/.test(line)) ||
    nonEmpty.find(
      (line) =>
        !/^(here|aquí|ingredients?|method|nutrition|servings?|time|original recipe)/i.test(
          stripMarkdown(line),
        ),
    ) ||
    "";

  const attribution = raw.match(
    /(?:Original recipe|Recipe by|By)\s*:?\s*\**([^,\n*]+?)\**\s*(?:,\s*\**([^*\n]+)\**)?(?:\n|$)/i,
  );

  const servings = raw.match(/(?:Servings?|Yield|Raciones?)\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  const time = raw.match(/(?:Time|Total time|Tiempo)\s*:?\s*([^\n]+)/i);

  const ingredientLines = findSection(
    lines,
    [/^ingredients?$/i, /^ingredientes$/i],
    [
      /^method$/i,
      /^directions?$/i,
      /^instructions?$/i,
      /^preparation$/i,
      /^approximate nutrition$/i,
      /^nutrition$/i,
      /^serving suggestion$/i,
    ],
  )
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line))
    .map(cleanLine);

  const method = parseMethod(lines);

  const servingSuggestionLines = findSection(
    lines,
    [/^serving suggestion$/i, /^sugerencia de servicio$/i],
    [/^notes?$/i],
  )
    .map(stripMarkdown)
    .filter(Boolean);

  const title = stripMarkdown(titleLine);
  const mainIngredients = inferMainIngredients(title, ingredientLines);

  return {
    title,
    author: attribution?.[1]?.trim() || "",
    publication: attribution?.[2]?.trim() || "",
    servings: servings?.[1]?.replace(",", ".") || "",
    time: time?.[1] ? stripMarkdown(time[1]) : "",
    ingredients: ingredientLines,
    method,
    calories: extractRange(raw, ["Calories", "Calorías"]),
    protein: extractRange(raw, ["Protein", "Proteína"]),
    carbs: extractRange(raw, ["Carbohydrates", "Carbs", "Hidratos"]),
    fat: extractRange(raw, ["Fat", "Grasa"]),
    fiber: extractRange(raw, ["Fiber", "Fibre", "Fibra"]),
    servingSuggestion: servingSuggestionLines.join("\n\n"),
    mainIngredients,
    methods: inferMethods(raw),
  };
}

function confidence(value: string | unknown[]): Confidence {
  if (Array.isArray(value)) return value.length ? "confirmed" : "missing";
  return value.trim() ? "confirmed" : "missing";
}

function StatusBadge({ value }: { value: Confidence }) {
  const labels = {
    confirmed: "Confirmed",
    review: "Review",
    missing: "Missing",
  };

  return (
    <span className={`${styles.status} ${styles[`status_${value}`]}`}>
      {value === "confirmed" ? (
        <Check aria-hidden="true" size={13} />
      ) : (
        <TriangleAlert aria-hidden="true" size={13} />
      )}
      {labels[value]}
    </span>
  );
}

function RangeInputs({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: NutritionRange;
  onChange: (value: NutritionRange) => void;
  unit: string;
}) {
  return (
    <div className={styles.rangeField}>
      <div className={styles.fieldLabel}>
        <label>{label}</label>
        <StatusBadge value={value.min ? "confirmed" : "missing"} />
      </div>
      <div className={styles.rangeInputs}>
        <input
          aria-label={`${label} minimum`}
          inputMode="decimal"
          onChange={(event) => onChange({ ...value, min: event.target.value })}
          placeholder="Min"
          value={value.min}
        />
        <span>to</span>
        <input
          aria-label={`${label} maximum`}
          inputMode="decimal"
          onChange={(event) => onChange({ ...value, max: event.target.value })}
          placeholder="Max"
          value={value.max}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

function PasteRecipePageContent() {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const reviewFields: ReviewField[] = useMemo(() => {
    if (!parsed) return [];
    return [
      { label: "Title", confidence: confidence(parsed.title) },
      { label: "Author", confidence: confidence(parsed.author) },
      { label: "Publication", confidence: confidence(parsed.publication) },
      { label: "Servings", confidence: confidence(parsed.servings) },
      { label: "Time", confidence: confidence(parsed.time) },
      { label: "Ingredients", confidence: confidence(parsed.ingredients) },
      { label: "Method", confidence: confidence(parsed.method) },
      {
        label: "Nutrition",
        confidence: parsed.calories.min && parsed.protein.min ? "confirmed" : "review",
      },
      {
        label: "Classification",
        confidence:
          parsed.mainIngredients.length && parsed.methods.length
            ? "confirmed"
            : "review",
      },
    ];
  }, [parsed]);

  async function handleExtract() {
    if (!raw.trim()) return;
    setIsParsing(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setParsed(parseRecipe(raw));
    setIsParsing(false);
  }

  function updateParsed<K extends keyof ParsedRecipe>(
    key: K,
    value: ParsedRecipe[K],
  ) {
    setParsed((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleSave() {
    if (!parsed) return;

    setIsSaving(true);

    try {
      const recipe = createAndSaveRecipe({
        title: parsed.title,
        author: parsed.author,
        publication: parsed.publication,
        servings: parsed.servings,
        time: parsed.time,
        ingredients: parsed.ingredients,
        method: parsed.method,
        calories: parsed.calories,
        protein: parsed.protein,
        carbs: parsed.carbs,
        fat: parsed.fat,
        fiber: parsed.fiber,
        servingSuggestion: parsed.servingSuggestion,
        mainIngredients: parsed.mainIngredients,
        methods: parsed.methods,
        rawSourceText: raw,
      });

      router.push(`/recipes/${recipe.id}`);
    } catch (error) {
      setIsSaving(false);
      window.alert(
        error instanceof Error ? error.message : "The recipe could not be saved.",
      );
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft aria-hidden="true" size={17} />
          Back to library
        </Link>
        <span className={styles.version}>Importer MVP · v0.3.4</span>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>Paste Recipe</p>
        <h1>Turn copied text into a recipe.</h1>
        <p>
          Paste a recipe from a website, social post, document or chat. Review
          what was extracted before saving it.
        </p>
      </section>

      {!parsed ? (
        <section className={styles.pasteLayout}>
          <div className={styles.pastePanel}>
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.stepLabel}>Step 1</p>
                <h2>Paste the complete recipe</h2>
              </div>
              <ClipboardPaste aria-hidden="true" size={24} />
            </div>

            <textarea
              aria-label="Recipe text"
              onChange={(event) => setRaw(event.target.value)}
              placeholder="Paste recipe text here..."
              value={raw}
            />

            <div className={styles.pasteActions}>
              <button
                className={styles.sampleButton}
                onClick={() => setRaw(SAMPLE_RECIPE)}
                type="button"
              >
                Load salmon example
              </button>

              <button
                className={styles.primaryButton}
                disabled={!raw.trim() || isParsing}
                onClick={handleExtract}
                type="button"
              >
                {isParsing ? (
                  <Loader2 aria-hidden="true" className={styles.spin} size={17} />
                ) : (
                  <Sparkles aria-hidden="true" size={17} />
                )}
                {isParsing ? "Reading recipe..." : "Extract recipe"}
              </button>
            </div>
          </div>

          <aside className={styles.helpPanel}>
            <FileText aria-hidden="true" size={26} />
            <h2>Best results</h2>
            <p>Include the full title, ingredient list and method.</p>
            <ul>
              <li>Markdown is supported.</li>
              <li>English and Spanish are supported.</li>
              <li>Nutrition ranges are preserved.</li>
              <li>Nothing is silently discarded.</li>
            </ul>
          </aside>
        </section>
      ) : (
        <>
          <section className={styles.reviewSummary}>
            <div>
              <p className={styles.stepLabel}>Step 2</p>
              <h2>Review the extraction</h2>
            </div>
            <div className={styles.reviewChips}>
              {reviewFields.map((field) => (
                <span key={field.label}>
                  {field.label}
                  <StatusBadge value={field.confidence} />
                </span>
              ))}
            </div>
          </section>

          <section className={styles.reviewLayout}>
            <aside className={styles.originalPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.stepLabel}>Original</p>
                  <h2>Pasted text</h2>
                </div>
                <button
                  className={styles.textButton}
                  onClick={() => setParsed(null)}
                  type="button"
                >
                  Edit original
                </button>
              </div>
              <pre>{raw}</pre>
            </aside>

            <form
              className={styles.extractedPanel}
              onSubmit={(event) => {
                event.preventDefault();
                handleSave();
              }}
            >
              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>01</p>
                <h2>Basics</h2>

                <div className={styles.field}>
                  <div className={styles.fieldLabel}>
                    <label htmlFor="title">Title</label>
                    <StatusBadge value={confidence(parsed.title)} />
                  </div>
                  <input
                    id="title"
                    onChange={(event) => updateParsed("title", event.target.value)}
                    value={parsed.title}
                  />
                </div>

                <div className={styles.twoColumns}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="author">Author</label>
                      <StatusBadge value={confidence(parsed.author)} />
                    </div>
                    <input
                      id="author"
                      onChange={(event) =>
                        updateParsed("author", event.target.value)
                      }
                      value={parsed.author}
                    />
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="publication">Publication</label>
                      <StatusBadge value={confidence(parsed.publication)} />
                    </div>
                    <input
                      id="publication"
                      onChange={(event) =>
                        updateParsed("publication", event.target.value)
                      }
                      value={parsed.publication}
                    />
                  </div>
                </div>

                <div className={styles.twoColumns}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="servings">Servings</label>
                      <StatusBadge value={confidence(parsed.servings)} />
                    </div>
                    <input
                      id="servings"
                      onChange={(event) =>
                        updateParsed("servings", event.target.value)
                      }
                      value={parsed.servings}
                    />
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="time">Time</label>
                      <StatusBadge value={confidence(parsed.time)} />
                    </div>
                    <input
                      id="time"
                      onChange={(event) => updateParsed("time", event.target.value)}
                      value={parsed.time}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>02</p>
                <h2>Classification</h2>

                <div className={styles.twoColumns}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="mainIngredients">Main ingredients</label>
                      <StatusBadge
                        value={confidence(parsed.mainIngredients)}
                      />
                    </div>
                    <input
                      id="mainIngredients"
                      onChange={(event) =>
                        updateParsed(
                          "mainIngredients",
                          event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        )
                      }
                      value={parsed.mainIngredients.join(", ")}
                    />
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="methods">Methods</label>
                      <StatusBadge value={confidence(parsed.methods)} />
                    </div>
                    <input
                      id="methods"
                      onChange={(event) =>
                        updateParsed(
                          "methods",
                          event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        )
                      }
                      value={parsed.methods.join(", ")}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>03</p>
                <h2>Ingredients</h2>
                <div className={styles.fieldLabel}>
                  <span>{parsed.ingredients.length} lines extracted</span>
                  <StatusBadge value={confidence(parsed.ingredients)} />
                </div>
                <textarea
                  className={styles.ingredientsTextarea}
                  onChange={(event) =>
                    updateParsed(
                      "ingredients",
                      event.target.value
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean),
                    )
                  }
                  value={parsed.ingredients.join("\n")}
                />
              </div>

              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>04</p>
                <h2>Method</h2>
                <div className={styles.methodEditor}>
                  {parsed.method.map((step, index) => (
                    <div className={styles.methodStep} key={`${step.title}-${index}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <input
                          aria-label={`Step ${index + 1} title`}
                          onChange={(event) => {
                            const next = [...parsed.method];
                            next[index] = { ...step, title: event.target.value };
                            updateParsed("method", next);
                          }}
                          value={step.title}
                        />
                        <textarea
                          aria-label={`Step ${index + 1} instructions`}
                          onChange={(event) => {
                            const next = [...parsed.method];
                            next[index] = { ...step, body: event.target.value };
                            updateParsed("method", next);
                          }}
                          value={step.body}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>05</p>
                <h2>Nutrition per serving</h2>
                <div className={styles.nutritionGrid}>
                  <RangeInputs
                    label="Calories"
                    onChange={(value) => updateParsed("calories", value)}
                    unit="kcal"
                    value={parsed.calories}
                  />
                  <RangeInputs
                    label="Protein"
                    onChange={(value) => updateParsed("protein", value)}
                    unit="g"
                    value={parsed.protein}
                  />
                  <RangeInputs
                    label="Carbohydrates"
                    onChange={(value) => updateParsed("carbs", value)}
                    unit="g"
                    value={parsed.carbs}
                  />
                  <RangeInputs
                    label="Fat"
                    onChange={(value) => updateParsed("fat", value)}
                    unit="g"
                    value={parsed.fat}
                  />
                  <RangeInputs
                    label="Fiber"
                    onChange={(value) => updateParsed("fiber", value)}
                    unit="g"
                    value={parsed.fiber}
                  />
                </div>
              </div>

              <div className={styles.formSection}>
                <p className={styles.sectionNumber}>06</p>
                <h2>Serving suggestion</h2>
                <textarea
                  onChange={(event) =>
                    updateParsed("servingSuggestion", event.target.value)
                  }
                  value={parsed.servingSuggestion}
                />
              </div>

              <div className={styles.saveBar}>
                <div>
                  <p>Missing fields are allowed. You can edit the recipe later.</p>
                </div>
                <button
                  className={styles.primaryButton}
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <Loader2 aria-hidden="true" className={styles.spin} size={17} />
                  ) : (
                    <Save aria-hidden="true" size={17} />
                  )}
                  {isSaving ? "Saving..." : "Save recipe"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}


export default function PasteRecipePage() {
  return (
    <AdminGate>
      <PasteRecipePageContent />
    </AdminGate>
  );
}
