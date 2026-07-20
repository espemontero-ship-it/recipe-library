"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { IngredientEditor } from "@/components/IngredientEditor";
import {
  createEntityId,
  type Recipe,
  type RecipeMethodSection,
} from "@/lib/recipeModel";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./RecipeEditor.module.css";

function csv(value: string[]) {
  return value.join(", ");
}

function parseCsv(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RecipeEditor({
  initialRecipe,
  onSave,
  mode = "edit",
  onCancel,
}: {
  initialRecipe: Recipe;
  onSave: (recipe: Recipe) => Promise<void>;
  mode?: "edit" | "review";
  onCancel?: () => void;
}) {
  const [recipe, setRecipe] = useState(initialRecipe);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function patch<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setRecipe((current) => ({ ...current, [key]: value }));
  }

  function updateMethodSections(sections: RecipeMethodSection[]) {
    patch("methodSections", sections);
  }

  function updateMacro(
    key: "calories" | "proteinG" | "carbohydratesG" | "fatG" | "fiberG",
    value: string,
  ) {
    const parsed = nullableNumber(value);
    patch("nutrition", {
      ...recipe.nutrition,
      scope: "per_serving",
      [key]: { min: parsed, max: parsed },
      note: "Manual values per serving.",
    });
  }

  async function recoverSourceDetails() {
    const url = recipe.source.originalUrl?.trim();
    if (!url) {
      setSourceMessage("Add the original URL first.");
      return;
    }
    setSourceLoading(true);
    setSourceMessage("");
    try {
      const response = await fetch("/api/source-metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const metadata = (await response.json()) as {
        sourceUrl?: string | null;
        author?: string | null;
        siteName?: string | null;
        imageUrl?: string | null;
        warning?: string | null;
      };
      setRecipe((current) => ({
        ...current,
        source: {
          ...current.source,
          originalUrl: metadata.sourceUrl || current.source.originalUrl,
          author: current.source.author || metadata.author || null,
          publication: current.source.publication || metadata.siteName || null,
        },
        media: {
          ...current.media,
          heroImage: metadata.imageUrl || current.media.heroImage,
        },
      }));
      setSourceMessage(metadata.warning || "Source details checked.");
    } catch {
      setSourceMessage("The source could not be inspected.");
    } finally {
      setSourceLoading(false);
    }
  }

  async function uploadImage(file: File) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSourceMessage("Supabase is not configured.");
      return;
    }
    setUploadingImage(true);
    setSourceMessage("");
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sign in before uploading an image.");
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `${userData.user.id}/${recipe.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      patch("media", { ...recipe.media, heroImage: data.publicUrl });
      setSourceMessage("Photo uploaded.");
    } catch (reason) {
      setSourceMessage(reason instanceof Error ? reason.message : "Photo upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!recipe.title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...recipe, updatedAt: new Date().toISOString() });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save recipe.");
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        {mode === "review" ? (
          <button className={styles.back} onClick={onCancel} type="button">
            <ArrowLeft aria-hidden="true" size={17} />
            Back to pasted text
          </button>
        ) : (
          <Link className={styles.back} href={`/recipes/${recipe.slug}`}>
            <ArrowLeft aria-hidden="true" size={17} />
            Back to recipe
          </Link>
        )}
        <button disabled={saving} form="recipe-editor" type="submit">
          <Save aria-hidden="true" size={17} />
          {saving ? "Saving…" : mode === "review" ? "Save recipe" : "Save changes"}
        </button>
      </div>

      <form id="recipe-editor" onSubmit={submit}>
        <header className={styles.header}>
          <p>{mode === "review" ? "Review parser result" : "Recipe editor"}</p>
          <h1>{recipe.title || "Untitled recipe"}</h1>
          <span>Every recipe field can be corrected here. Technical source text remains read-only.</span>
        </header>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.block}>
          <div className={styles.blockTitle}>
            <span>01</span>
            <div>
              <h2>Information</h2>
              <p>Identity, source, times and classification.</p>
            </div>
          </div>

          <div className={styles.gridTwo}>
            <label className={styles.fieldWide}>
              <span>Title</span>
              <input
                onChange={(event) => patch("title", event.target.value)}
                value={recipe.title}
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Description</span>
              <textarea
                onChange={(event) => patch("summary", event.target.value || null)}
                rows={3}
                value={recipe.summary ?? ""}
              />
            </label>

            <label>
              <span>Servings</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  patch("yield", {
                    ...recipe.yield,
                    servings: nullableNumber(event.target.value),
                    servingsDisplay: event.target.value || null,
                  })
                }
                value={recipe.yield.servingsDisplay ?? recipe.yield.servings ?? ""}
              />
            </label>
            <label>
              <span>Time display</span>
              <input
                onChange={(event) =>
                  patch("yield", { ...recipe.yield, timeDisplay: event.target.value || null })
                }
                placeholder="About 4 hours"
                value={recipe.yield.timeDisplay ?? ""}
              />
            </label>

            {[
              ["prepMinutes", "Prep minutes"],
              ["cookMinutes", "Cook minutes"],
              ["restingMinutes", "Resting minutes"],
              ["marinatingMinutes", "Marinating minutes"],
              ["totalMinutes", "Total minutes"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  inputMode="numeric"
                  onChange={(event) =>
                    patch("yield", {
                      ...recipe.yield,
                      [key]: nullableNumber(event.target.value),
                    })
                  }
                  value={recipe.yield[key as keyof typeof recipe.yield] ?? ""}
                />
              </label>
            ))}
          </div>

          <h3 className={styles.subheading}>Author and source</h3>
          <div className={styles.gridTwo}>
            <label>
              <span>Recipe author</span>
              <input
                onChange={(event) =>
                  patch("source", { ...recipe.source, author: event.target.value || null })
                }
                value={recipe.source.author ?? ""}
              />
            </label>
            <label>
              <span>Publication, account or book</span>
              <input
                onChange={(event) =>
                  patch("source", { ...recipe.source, publication: event.target.value || null })
                }
                value={recipe.source.publication ?? ""}
              />
            </label>
            <label>
              <span>Source type</span>
              <select
                onChange={(event) =>
                  patch("source", { ...recipe.source, type: event.target.value || null })
                }
                value={recipe.source.type ?? ""}
              >
                <option value="">Choose type</option>
                <option value="web">Web</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="book">Book</option>
                <option value="own">Own recipe</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className={styles.fieldWide}>
              <span>Original URL</span>
              <div className={styles.inlineAction}>
                <input
                  inputMode="url"
                  onChange={(event) =>
                    patch("source", { ...recipe.source, originalUrl: event.target.value || null })
                  }
                  value={recipe.source.originalUrl ?? ""}
                />
                <button disabled={sourceLoading} onClick={() => void recoverSourceDetails()} type="button">
                  {sourceLoading ? <Loader2 aria-hidden="true" size={16} /> : <RefreshCw aria-hidden="true" size={16} />}
                  Check source
                </button>
              </div>
            </label>
            <div className={`${styles.fieldWide} ${styles.imageEditor}`}>
              <span>Cover image</span>
              <div className={styles.imageRow}>
                <div className={styles.imagePreview}>
                  {recipe.media.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="Recipe cover preview" src={recipe.media.heroImage} />
                  ) : (
                    <ImageIcon aria-hidden="true" size={28} />
                  )}
                </div>
                <div className={styles.imageControls}>
                  <input
                    aria-label="Cover image URL"
                    inputMode="url"
                    onChange={(event) =>
                      patch("media", { ...recipe.media, heroImage: event.target.value || null })
                    }
                    placeholder="Image URL"
                    value={recipe.media.heroImage ?? ""}
                  />
                  <label className={styles.uploadButton}>
                    <Upload aria-hidden="true" size={16} />
                    {uploadingImage ? "Uploading…" : "Upload photo"}
                    <input
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadImage(file);
                        event.currentTarget.value = "";
                      }}
                      type="file"
                    />
                  </label>
                </div>
              </div>
              {sourceMessage && <p className={styles.helperMessage}>{sourceMessage}</p>}
            </div>
          </div>

          <h3 className={styles.subheading}>Classification</h3>
          <div className={styles.gridTwo}>
            {[
              ["ingredientsIndex", "Main ingredients"],
              ["dish", "Dish type"],
              ["formats", "Format"],
              ["mealTypes", "Meal"],
              ["cookingMethods", "Cooking methods"],
              ["cuisines", "Cuisine"],
              ["collections", "Collections"],
              ["tags", "Tags"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  onChange={(event) =>
                    patch("classification", {
                      ...recipe.classification,
                      [key]: parseCsv(event.target.value),
                      ...(key === "ingredientsIndex"
                        ? { mainIngredients: parseCsv(event.target.value) }
                        : {}),
                    })
                  }
                  placeholder="Separate with commas"
                  value={csv(recipe.classification[key as keyof typeof recipe.classification] as string[])}
                />
              </label>
            ))}
          </div>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>
            <span>02</span>
            <div>
              <h2>Ingredients and macros</h2>
              <p>Edit the ingredient parsing and add manual macros per serving.</p>
            </div>
          </div>

          <div className={styles.nutritionSummary}>
            <div>
              <span>
                <strong>Macros per serving</strong>
                Enter values calculated outside Recipe Library. Leave any field blank if it is not available yet.
              </span>
            </div>
            <div className={styles.gridTwo}>
              {[
                ["calories", "Calories", "kcal"],
                ["proteinG", "Protein", "g"],
                ["carbohydratesG", "Carbohydrates", "g"],
                ["fatG", "Fat", "g"],
                ["fiberG", "Fiber", "g"],
              ].map(([key, label, suffix]) => (
                <label key={key}>
                  <span>{label} per serving</span>
                  <div className={styles.inlineAction}>
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateMacro(
                          key as "calories" | "proteinG" | "carbohydratesG" | "fatG" | "fiberG",
                          event.target.value,
                        )
                      }
                      value={recipe.nutrition[key as keyof typeof recipe.nutrition] &&
                        typeof recipe.nutrition[key as keyof typeof recipe.nutrition] === "object"
                          ? (recipe.nutrition[key as "calories" | "proteinG" | "carbohydratesG" | "fatG" | "fiberG"].min ?? "")
                          : ""}
                    />
                    <span>{suffix}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <IngredientEditor
            onChange={(ingredientSections) => patch("ingredientSections", ingredientSections)}
            sections={recipe.ingredientSections}
          />
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>
            <span>03</span>
            <div>
              <h2>Preparation</h2>
              <p>Edit, add, delete and reorder steps.</p>
            </div>
          </div>

          {recipe.methodSections.map((section, sectionIndex) => (
            <div className={styles.methodSection} key={section.id}>
              <input
                aria-label={`Method section ${sectionIndex + 1} title`}
                className={styles.sectionTitleInput}
                onChange={(event) =>
                  updateMethodSections(
                    recipe.methodSections.map((current, index) =>
                      index === sectionIndex
                        ? { ...current, title: event.target.value || null }
                        : current,
                    ),
                  )
                }
                placeholder="Section title (optional)"
                value={section.title ?? ""}
              />

              {section.steps.map((step, stepIndex) => (
                <article className={styles.step} key={step.id}>
                  <div className={styles.stepNumber}>{String(stepIndex + 1).padStart(2, "0")}</div>
                  <div className={styles.stepFields}>
                    <input
                      aria-label={`Step ${stepIndex + 1} title`}
                      onChange={(event) =>
                        updateMethodSections(
                          recipe.methodSections.map((current, index) =>
                            index === sectionIndex
                              ? {
                                  ...current,
                                  steps: current.steps.map((currentStep, currentStepIndex) =>
                                    currentStepIndex === stepIndex
                                      ? { ...currentStep, title: event.target.value || null }
                                      : currentStep,
                                  ),
                                }
                              : current,
                          ),
                        )
                      }
                      placeholder="Step title (optional)"
                      value={step.title ?? ""}
                    />
                    <textarea
                      aria-label={`Step ${stepIndex + 1} instructions`}
                      onChange={(event) =>
                        updateMethodSections(
                          recipe.methodSections.map((current, index) =>
                            index === sectionIndex
                              ? {
                                  ...current,
                                  steps: current.steps.map((currentStep, currentStepIndex) =>
                                    currentStepIndex === stepIndex
                                      ? { ...currentStep, body: event.target.value }
                                      : currentStep,
                                  ),
                                }
                              : current,
                          ),
                        )
                      }
                      rows={4}
                      value={step.body}
                    />
                  </div>
                  <div className={styles.stepActions}>
                    <button
                      aria-label="Move step up"
                      disabled={stepIndex === 0}
                      onClick={() =>
                        updateMethodSections(
                          recipe.methodSections.map((current, index) =>
                            index === sectionIndex
                              ? { ...current, steps: move(current.steps, stepIndex, stepIndex - 1) }
                              : current,
                          ),
                        )
                      }
                      type="button"
                    ><ArrowUp aria-hidden="true" size={15} /></button>
                    <button
                      aria-label="Move step down"
                      disabled={stepIndex === section.steps.length - 1}
                      onClick={() =>
                        updateMethodSections(
                          recipe.methodSections.map((current, index) =>
                            index === sectionIndex
                              ? { ...current, steps: move(current.steps, stepIndex, stepIndex + 1) }
                              : current,
                          ),
                        )
                      }
                      type="button"
                    ><ArrowDown aria-hidden="true" size={15} /></button>
                    <button
                      aria-label="Delete step"
                      onClick={() =>
                        updateMethodSections(
                          recipe.methodSections.map((current, index) =>
                            index === sectionIndex
                              ? { ...current, steps: current.steps.filter((_, index) => index !== stepIndex) }
                              : current,
                          ),
                        )
                      }
                      type="button"
                    ><Trash2 aria-hidden="true" size={15} /></button>
                  </div>
                </article>
              ))}

              <button
                className={styles.addButton}
                onClick={() =>
                  updateMethodSections(
                    recipe.methodSections.map((current, index) =>
                      index === sectionIndex
                        ? {
                            ...current,
                            steps: [
                              ...current.steps,
                              {
                                id: createEntityId("step"),
                                title: null,
                                body: "",
                                durationMinutes: null,
                                temperatureC: null,
                              },
                            ],
                          }
                        : current,
                    ),
                  )
                }
                type="button"
              >
                <Plus aria-hidden="true" size={16} /> Add step
              </button>
            </div>
          ))}

          <button
            className={styles.addButton}
            onClick={() =>
              updateMethodSections([
                ...recipe.methodSections,
                { id: createEntityId("method_section"), title: null, steps: [] },
              ])
            }
            type="button"
          >
            <Plus aria-hidden="true" size={16} /> Add method section
          </button>
        </section>

        <section className={styles.block}>
          <div className={styles.blockTitle}>
            <span>04</span>
            <div>
              <h2>Notes</h2>
              <p>Serving, storage or source notes. Private notes remain in the normal recipe view.</p>
            </div>
          </div>
          <div className={styles.gridTwo}>
            <label className={styles.fieldWide}>
              <span>Serving suggestion</span>
              <textarea
                onChange={(event) => patch("servingSuggestion", event.target.value || null)}
                rows={3}
                value={recipe.servingSuggestion ?? ""}
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Public notes</span>
              <textarea
                onChange={(event) => patch("publicNotes", event.target.value || null)}
                rows={4}
                value={recipe.publicNotes ?? ""}
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Storage</span>
              <textarea
                onChange={(event) => patch("storageNotes", event.target.value || null)}
                rows={3}
                value={recipe.storageNotes ?? ""}
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Reheating</span>
              <textarea
                onChange={(event) => patch("reheatingNotes", event.target.value || null)}
                rows={3}
                value={recipe.reheatingNotes ?? ""}
              />
            </label>
            <label className={styles.fieldWide}>
              <span>Nutrition note</span>
              <textarea
                onChange={(event) => patch("nutritionNotes", event.target.value || null)}
                placeholder="For example: excludes optional serving suggestions"
                rows={3}
                value={recipe.nutritionNotes ?? ""}
              />
            </label>
          </div>

          <details className={styles.rawSource}>
            <summary>View original imported text</summary>
            <pre>{recipe.rawSourceText || "No original text stored."}</pre>
          </details>
        </section>

        <div className={styles.saveBar}>
          <p>Macros are saved manually per serving. Ingredient editing does not change them automatically.</p>
          <button disabled={saving} type="submit">
            <Save aria-hidden="true" size={17} />
            {saving ? "Saving…" : mode === "review" ? "Save recipe" : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}
