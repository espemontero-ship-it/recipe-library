"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IngredientEditor } from "@/components/IngredientEditor";
import { NumericField } from "@/components/NumericField";
import { TagListField } from "@/components/TagListField";
import {
  createEntityId,
  type Recipe,
  type RecipeClassification,
  type RecipeMethodSection,
} from "@/lib/recipeModel";
import { getSupabaseClient } from "@/lib/supabase";
import { parseSimpleNumber } from "@/lib/ingredientParser";
import styles from "./RecipeEditor.module.css";

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function validate(recipe: Recipe) {
  if (!recipe.title.trim()) return "A title is required.";
  const hasIngredient = recipe.ingredientSections.some((section) =>
    section.items.some(
      (item) => item.canonicalIngredient?.trim() || item.originalLine.trim(),
    ),
  );
  if (!hasIngredient) return "Add at least one ingredient.";
  const hasStep = recipe.methodSections.some((section) =>
    section.steps.some((step) => step.body.trim()),
  );
  if (!hasStep) return "Add at least one method step.";
  return "";
}

function imageFileName(url: string | null) {
  if (!url) return "No image selected";
  try {
    const last = url.split("/").pop() ?? url;
    return decodeURIComponent(last.split("?")[0]) || "Custom image";
  } catch {
    return "Custom image";
  }
}

const CLASSIFICATION_FIELDS: Array<[keyof RecipeClassification, string]> = [
  ["ingredientsIndex", "Main ingredients"],
  ["dish", "Dish type"],
  ["formats", "Format"],
  ["mealTypes", "Meal"],
  ["cookingMethods", "Cooking methods"],
  ["cuisines", "Cuisine"],
  ["collections", "Collections"],
  ["tags", "Tags"],
];

type TimeFieldKey =
  | "prepMinutes"
  | "cookMinutes"
  | "restingMinutes"
  | "marinatingMinutes"
  | "totalMinutes";

const TIME_FIELDS: Array<[TimeFieldKey, string]> = [
  ["prepMinutes", "Prep minutes"],
  ["cookMinutes", "Cook minutes"],
  ["restingMinutes", "Resting minutes"],
  ["marinatingMinutes", "Marinating minutes"],
  ["totalMinutes", "Total minutes"],
];

const MACRO_FIELDS: Array<
  [keyof Pick<Recipe["nutrition"], "calories" | "proteinG" | "carbohydratesG" | "fatG" | "fiberG">, string, string]
> = [
  ["calories", "Calories", "kcal"],
  ["proteinG", "Protein", "g"],
  ["carbohydratesG", "Carbohydrates", "g"],
  ["fatG", "Fat", "g"],
  ["fiberG", "Fiber", "g"],
];

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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!dirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => () => window.clearTimeout(savedTimeout.current), []);

  function patch<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setRecipe((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function updateMethodSections(sections: RecipeMethodSection[]) {
    patch("methodSections", sections);
  }

  function updateMacro(key: (typeof MACRO_FIELDS)[number][0], value: number | null) {
    patch("nutrition", {
      ...recipe.nutrition,
      scope: "per_serving",
      [key]: { min: value, max: value },
      note: "Manual values per serving.",
    });
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
    const validationError = validate(recipe);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...recipe, updatedAt: new Date().toISOString() });
      setDirty(false);
      setJustSaved(true);
      window.clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setJustSaved(false), 4000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        {mode === "review" ? (
          <button className={styles.back} onClick={onCancel} type="button">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to pasted text
          </button>
        ) : (
          <Link className={styles.back} href={`/recipes/${recipe.slug}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            Back to recipe
          </Link>
        )}
        <div className={styles.topBarRight}>
          {justSaved && (
            <span className={styles.savedBadge}>
              <Check aria-hidden="true" size={14} />
              Saved
            </span>
          )}
          <button className={styles.saveBtn} disabled={saving} form="recipe-editor" type="submit">
            <Save aria-hidden="true" size={15} />
            {saving ? "Saving…" : mode === "review" ? "Save recipe" : "Save changes"}
          </button>
        </div>
      </div>

      <form id="recipe-editor" onSubmit={submit}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>{mode === "review" ? "Review parser result" : "Recipe editor"}</p>
          <h1>{recipe.title || "Untitled recipe"}</h1>
        </div>

        <div className={styles.sourceStrip}>
          <div className={styles.sourceHead}>
            <span>Original pasted text</span>
            <button onClick={() => setSourceCollapsed((current) => !current)} type="button">
              {sourceCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!sourceCollapsed && (
            <pre className={styles.sourceBody}>{recipe.rawSourceText || "No original text stored."}</pre>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Identity &amp; source</h2>
          </div>
          <div className={styles.bandBody}>
            <div className={styles.fieldGridWide}>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Title</span>
                <input
                  onChange={(event) => patch("title", event.target.value)}
                  value={recipe.title}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Description</span>
                <textarea
                  onChange={(event) => patch("summary", event.target.value || null)}
                  rows={2}
                  value={recipe.summary ?? ""}
                />
              </label>
            </div>

            <h3 className={styles.subhead}>Yield &amp; time</h3>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Servings</span>
                <input
                  onChange={(event) =>
                    patch("yield", {
                      ...recipe.yield,
                      servings: parseSimpleNumber(event.target.value),
                      servingsDisplay: event.target.value || null,
                    })
                  }
                  value={recipe.yield.servingsDisplay ?? recipe.yield.servings ?? ""}
                />
              </label>
              <label className={styles.field}>
                <span>Time display</span>
                <input
                  onChange={(event) =>
                    patch("yield", { ...recipe.yield, timeDisplay: event.target.value || null })
                  }
                  placeholder="About 4 hours"
                  value={recipe.yield.timeDisplay ?? ""}
                />
              </label>
              {TIME_FIELDS.map(([key, label]) => (
                <label className={styles.field} key={key}>
                  <span>{label}</span>
                  <NumericField
                    className={styles.numericInput}
                    onCommit={(value) => patch("yield", { ...recipe.yield, [key]: value })}
                    value={recipe.yield[key]}
                    warningClassName={styles.warn}
                  />
                </label>
              ))}
            </div>

            <h3 className={styles.subhead}>Author &amp; source</h3>
            <div className={styles.fieldGridWide}>
              <label className={styles.field}>
                <span>Recipe author</span>
                <input
                  onChange={(event) =>
                    patch("source", { ...recipe.source, author: event.target.value || null })
                  }
                  value={recipe.source.author ?? ""}
                />
              </label>
              <label className={styles.field}>
                <span>Publication, account or book</span>
                <input
                  onChange={(event) =>
                    patch("source", { ...recipe.source, publication: event.target.value || null })
                  }
                  value={recipe.source.publication ?? ""}
                />
              </label>
              <label className={styles.field}>
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
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Original URL</span>
                <input
                  inputMode="url"
                  onChange={(event) =>
                    patch("source", { ...recipe.source, originalUrl: event.target.value || null })
                  }
                  value={recipe.source.originalUrl ?? ""}
                />
              </label>
            </div>

            <h3 className={styles.subhead}>Cover image</h3>
            <div className={styles.imageRow}>
              <div className={styles.imagePreview}>
                {recipe.media.heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="Recipe cover preview" src={recipe.media.heroImage} />
                ) : (
                  <ImageIcon aria-hidden="true" size={26} />
                )}
              </div>
              <div className={styles.imageMeta}>
                <p className={styles.fileName}>{imageFileName(recipe.media.heroImage)}</p>
                <p className={styles.fileHint}>
                  {recipe.media.heroImage ? "Hosted image" : "No image yet"}
                </p>
                <div className={styles.imageActions}>
                  <label className={styles.uploadButton}>
                    <Upload aria-hidden="true" size={14} />
                    {uploadingImage ? "Uploading…" : recipe.media.heroImage ? "Replace" : "Upload"}
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
                  {recipe.media.heroImage && (
                    <button
                      className={styles.removeImageButton}
                      onClick={() => patch("media", { ...recipe.media, heroImage: null })}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                      Remove
                    </button>
                  )}
                </div>
                <input
                  aria-label="Cover image URL"
                  className={styles.urlInput}
                  inputMode="url"
                  onChange={(event) =>
                    patch("media", { ...recipe.media, heroImage: event.target.value || null })
                  }
                  placeholder="Or paste an image URL"
                  value={recipe.media.heroImage ?? ""}
                />
                {sourceMessage && <p className={styles.helperMessage}>{sourceMessage}</p>}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Classification</h2>
          </div>
          <div className={styles.bandBody}>
            <div className={styles.fieldGridWide}>
              {CLASSIFICATION_FIELDS.map(([key, label]) => (
                <div className={styles.tagField} key={key}>
                  <label>{label}</label>
                  <TagListField
                    containerClassName={styles.pills}
                    inputClassName={styles.pillInput}
                    onChange={(values) =>
                      patch("classification", {
                        ...recipe.classification,
                        [key]: values,
                        ...(key === "ingredientsIndex" ? { mainIngredients: values } : {}),
                      })
                    }
                    pillClassName={styles.pill}
                    removeClassName={styles.pillRemove}
                    values={recipe.classification[key]}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Nutrition · per serving</h2>
          </div>
          <div className={styles.bandBody}>
            <p className={styles.bandHint}>
              Values are entered manually and don&apos;t recalculate from ingredient edits.
            </p>
            <div className={styles.fieldGrid}>
              {MACRO_FIELDS.map(([key, label, suffix]) => (
                <label className={styles.field} key={key}>
                  <span>
                    {label} · {suffix}
                  </span>
                  <NumericField
                    className={styles.numericInput}
                    onCommit={(value) => updateMacro(key, value)}
                    value={recipe.nutrition[key].min}
                    warningClassName={styles.warn}
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Ingredients</h2>
          </div>
          <div className={styles.bandBody}>
            <IngredientEditor
              onChange={(ingredientSections) => patch("ingredientSections", ingredientSections)}
              sections={recipe.ingredientSections}
            />
          </div>
        </section>

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Method</h2>
          </div>
          <div className={styles.bandBody}>
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
                        rows={3}
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
                      >
                        <ArrowUp aria-hidden="true" size={14} />
                      </button>
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
                      >
                        <ArrowDown aria-hidden="true" size={14} />
                      </button>
                      <button
                        aria-label="Delete step"
                        className={styles.stepDelete}
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
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
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
                  <Plus aria-hidden="true" size={15} /> Add step
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
              <Plus aria-hidden="true" size={15} /> Add method section
            </button>
          </div>
        </section>

        <section className={styles.band}>
          <div className={styles.bandHead}>
            <h2>Notes</h2>
          </div>
          <div className={styles.bandBody}>
            <div className={styles.fieldGridWide}>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Serving suggestion</span>
                <textarea
                  onChange={(event) => patch("servingSuggestion", event.target.value || null)}
                  rows={2}
                  value={recipe.servingSuggestion ?? ""}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Public notes</span>
                <textarea
                  onChange={(event) => patch("publicNotes", event.target.value || null)}
                  rows={2}
                  value={recipe.publicNotes ?? ""}
                />
              </label>
              <label className={styles.field}>
                <span>Storage</span>
                <textarea
                  onChange={(event) => patch("storageNotes", event.target.value || null)}
                  rows={2}
                  value={recipe.storageNotes ?? ""}
                />
              </label>
              <label className={styles.field}>
                <span>Reheating</span>
                <textarea
                  onChange={(event) => patch("reheatingNotes", event.target.value || null)}
                  rows={2}
                  value={recipe.reheatingNotes ?? ""}
                />
              </label>
              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span>Nutrition note</span>
                <textarea
                  onChange={(event) => patch("nutritionNotes", event.target.value || null)}
                  placeholder="For example: excludes optional serving suggestions"
                  rows={2}
                  value={recipe.nutritionNotes ?? ""}
                />
              </label>
            </div>
          </div>
        </section>

        <div className={styles.saveFooter}>
          <p>Macros are saved manually per serving. Ingredient editing does not change them automatically.</p>
          <button className={styles.saveBtn} disabled={saving} type="submit">
            <Save aria-hidden="true" size={15} />
            {saving ? "Saving…" : mode === "review" ? "Save recipe" : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}
