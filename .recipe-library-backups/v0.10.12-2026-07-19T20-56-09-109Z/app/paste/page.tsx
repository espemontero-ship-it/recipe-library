"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import styles from "./paste.module.css";
import { createSupabaseRecipe } from "@/lib/supabaseRecipes";
import { AdminGate } from "@/components/AdminGate";
import {
  extractPasteContextFromHtml,
  normalizeSourceUrl,
  parseRecipe,
  sourceFromUrl,
  type NutritionRange,
  type ParsedRecipe,
  type PasteContext,
} from "@/lib/recipePasteParser";

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
  const [pasteContext, setPasteContext] = useState<PasteContext>({});
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isFetchingSource, setIsFetchingSource] = useState(false);
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const reviewFields: ReviewField[] = useMemo(() => {
    if (!parsed) return [];
    return [
      { label: "Title", confidence: confidence(parsed.title) },
      { label: "Author", confidence: confidence(parsed.author) },
      { label: "Publication", confidence: confidence(parsed.publication) },
      { label: "Source URL", confidence: confidence(parsed.sourceUrl) },
      { label: "Cover image", confidence: confidence(parsed.imageUrl) },
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

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    const uri = event.clipboardData
      .getData("text/uri-list")
      .split(/\r?\n/)
      .find((line) => /^https?:\/\//i.test(line.trim()));
    const htmlContext = extractPasteContextFromHtml(html);

    setPasteContext((current) => ({
      sourceUrl:
        htmlContext.sourceUrl ||
        (uri ? normalizeSourceUrl(uri) : "") ||
        current.sourceUrl,
      imageUrl: htmlContext.imageUrl || current.imageUrl,
    }));
  }

  async function readSourceMetadata(sourceUrl: string) {
    setIsFetchingSource(true);
    try {
      const response = await fetch("/api/source-metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const metadata = (await response.json()) as {
        sourceUrl?: string | null;
        title?: string | null;
        siteName?: string | null;
        author?: string | null;
        imageUrl?: string | null;
        warning?: string | null;
      };
      return metadata;
    } catch {
      return {
        sourceUrl,
        imageUrl: null,
        warning: "The source page could not be inspected.",
      };
    } finally {
      setIsFetchingSource(false);
    }
  }

  async function enrichFromSource(recipe: ParsedRecipe, forceImage = false) {
    if (!recipe.sourceUrl) return;
    const metadata = await readSourceMetadata(recipe.sourceUrl);
    setParsed((current) => {
      if (!current || current.sourceUrl !== recipe.sourceUrl) return current;
      const imageUrl = forceImage
        ? metadata.imageUrl?.trim() || ""
        : current.imageUrl || metadata.imageUrl?.trim() || "";
      return {
        ...current,
        title: current.title || metadata.title?.trim() || "",
        author: current.author || metadata.author?.trim() || "",
        publication: current.publication || metadata.siteName?.trim() || "",
        sourceUrl: metadata.sourceUrl?.trim() || current.sourceUrl,
        imageUrl,
        imageStatus: imageUrl
          ? current.imageUrl
            ? current.imageStatus
            : "found_source"
          : "missing",
        imageWarning: metadata.warning?.trim() || "",
      };
    });
  }

  async function handleExtract() {
    if (!raw.trim()) return;
    setIsParsing(true);
    const nextRecipe = parseRecipe(raw, pasteContext);
    setParsed(nextRecipe);
    setIsParsing(false);
    void enrichFromSource(nextRecipe);
  }

  async function handleFindSourceImage() {
    if (!parsed?.sourceUrl.trim()) return;
    await enrichFromSource(parsed, true);
  }

  function updateParsed<K extends keyof ParsedRecipe>(
    key: K,
    value: ParsedRecipe[K],
  ) {
    setParsed((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSave() {
    if (!parsed) return;

    setIsSaving(true);

    try {
      const recipe = await createSupabaseRecipe({
        title: parsed.title,
        author: parsed.author,
        publication: parsed.publication,
        originalUrl: parsed.sourceUrl,
        image: parsed.imageUrl,
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

      router.push(`/recipes/${recipe.slug}`);
      router.refresh();
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
        <span className={styles.version}>Importer · v0.9.1.10</span>
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
              onPaste={handlePaste}
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
                void handleSave();
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

                <div className={styles.field}>
                  <div className={styles.fieldLabel}>
                    <label htmlFor="sourceUrl">Source URL</label>
                    <StatusBadge value={confidence(parsed.sourceUrl)} />
                  </div>
                  <div className={styles.sourceInputRow}>
                    <div className={styles.inputWithIcon}>
                      <Link2 aria-hidden="true" size={17} />
                      <input
                        id="sourceUrl"
                        inputMode="url"
                        onChange={(event) => {
                          const sourceUrl = event.target.value;
                          setParsed((current) =>
                            current
                              ? {
                                  ...current,
                                  sourceUrl,
                                  publication:
                                    current.publication || sourceFromUrl(sourceUrl),
                                }
                              : current,
                          );
                        }}
                        placeholder="https://…"
                        value={parsed.sourceUrl}
                      />
                    </div>
                    <button
                      className={styles.secondaryButton}
                      disabled={!parsed.sourceUrl.trim() || isFetchingSource}
                      onClick={() => void handleFindSourceImage()}
                      type="button"
                    >
                      <RefreshCw
                        aria-hidden="true"
                        className={isFetchingSource ? styles.spin : undefined}
                        size={16}
                      />
                      {isFetchingSource ? "Checking…" : "Find image"}
                    </button>
                  </div>
                </div>

                <div className={styles.imageField}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>
                      <label htmlFor="imageUrl">Cover image URL</label>
                      <StatusBadge value={confidence(parsed.imageUrl)} />
                    </div>
                    <div className={styles.inputWithIcon}>
                      <ImageIcon aria-hidden="true" size={17} />
                      <input
                        id="imageUrl"
                        inputMode="url"
                        onChange={(event) =>
                          updateParsed("imageUrl", event.target.value)
                        }
                        placeholder="Image not found yet"
                        value={parsed.imageUrl}
                      />
                    </div>
                    <p className={styles.imageStatus}>
                      {parsed.imageUrl
                        ? parsed.imageStatus === "found_clipboard"
                          ? "Image found in the copied page."
                          : "Image found from the source page."
                        : parsed.imageWarning || "No image found. You can paste an image URL manually."}
                    </p>
                  </div>
                  <div className={styles.imagePreview}>
                    {parsed.imageUrl ? (
                      <img
                        alt={`Preview for ${parsed.title || "recipe"}`}
                        onError={() => {
                          setParsed((current) =>
                            current
                              ? {
                                  ...current,
                                  imageUrl: "",
                                  imageStatus: "missing",
                                  imageWarning: "The image URL could not be loaded.",
                                }
                              : current,
                          );
                        }}
                        src={parsed.imageUrl}
                      />
                    ) : (
                      <div>
                        <ImageIcon aria-hidden="true" size={26} />
                        <span>No preview</span>
                      </div>
                    )}
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
                  {!parsed.method.length && (
                    <p className={styles.emptyState}>No preparation steps were detected.</p>
                  )}
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
