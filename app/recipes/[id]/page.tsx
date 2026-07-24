"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Clock3,
  ExternalLink,
  Pencil,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RecipeQuickActions } from "@/components/RecipeQuickActions";
import { useAuth } from "@/lib/auth";
import {
  loadPrivateRecipeNotes,
  savePersonalState,
  subscribeToPersonalState,
} from "@/lib/personalRecipeState";
import { getSupabaseRecipe, getSupabaseRecipes } from "@/lib/supabaseRecipes";
import {
  addRecipesToPlanning,
  getPlanning,
  getWeekStart,
  removePlanningItem,
  subscribeToPlanning,
} from "@/lib/planning";
import { regenerateShoppingWeekIfExists } from "@/lib/shoppingList";
import { ingredientDisplayLine } from "@/lib/ingredientParser";
import {
  formatRange,
  getRecipeIngredients,
  getRecipeSteps,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./recipe.module.css";

export default function RecipePage() {
  const params = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [privateNotesDraft, setPrivateNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [thisWeekItemId, setThisWeekItemId] = useState<string | null>(null);
  const [planningBusy, setPlanningBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setRecipe(undefined);

    getSupabaseRecipe(params.id)
      .then((item) => {
        if (active) setRecipe(item);
      })
      .catch(() => {
        if (active) setRecipe(null);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!recipe || !isAdmin) return;

    let active = true;
    loadPrivateRecipeNotes(recipe.id)
      .then((notes) => {
        if (!active) return;
        setPrivateNotesDraft(notes ?? "");
        setRecipe((current) =>
          current
            ? {
                ...current,
                personal: { ...current.personal, privateNotes: notes },
              }
            : current,
        );
      })
      .catch(() => {
        if (active) setSaveError("Could not load private notes.");
      });

    return () => {
      active = false;
    };
  }, [isAdmin, recipe?.id]);

  useEffect(() => {
    if (!user) {
      setThisWeekItemId(null);
      return;
    }

    let active = true;
    const refreshPlan = async () => {
      try {
        const items = await getPlanning();
        const thisWeekItem = items.find(
          (item) =>
            item.recipeId === recipe?.id && item.weekStart === getWeekStart(),
        );
        if (active) setThisWeekItemId(thisWeekItem?.id ?? null);
      } catch {
        if (active) setThisWeekItemId(null);
      }
    };
    void refreshPlan();
    const unsubscribe = subscribeToPlanning(() => void refreshPlan());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [recipe?.id, user]);

  useEffect(
    () =>
      subscribeToPersonalState(() => {
        getSupabaseRecipe(params.id)
          .then((item) => {
            if (item) {
              const merged = item;
              setRecipe((current) => ({
                ...merged,
                personal: {
                  ...merged.personal,
                  privateNotes: current?.personal.privateNotes ?? null,
                },
              }));
            }
          })
          .catch(() => undefined);
      }),
    [params.id],
  );

  async function updatePersonal(
    patch: Partial<Pick<Recipe["personal"], "privateNotes">>,
  ) {
    if (!recipe || !isAdmin || saving) return;

    setSaving(true);
    setSaveError("");

    try {
      const updated = await savePersonalState(recipe, patch);
      setRecipe(updated);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "Could not save the change.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleThisWeek() {
    if (!recipe || planningBusy) return;
    setPlanningBusy(true);
    setSaveError("");
    try {
      if (thisWeekItemId) {
        await removePlanningItem(thisWeekItemId);
      } else {
        await addRecipesToPlanning([recipe], getWeekStart());
      }
      const recipes = await getSupabaseRecipes();
      await regenerateShoppingWeekIfExists(recipes, getWeekStart());
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "Could not update this week.",
      );
    } finally {
      setPlanningBusy(false);
    }
  }

  if (recipe === undefined) {
    return <main className={styles.messagePage}>Loading recipe…</main>;
  }

  if (!recipe) {
    return (
      <main className={styles.messagePage}>
        <p className={styles.eyebrow}>Recipe not found</p>
        <h1>This recipe was not found in the database.</h1>
        <Link href="/browse">Return to the library</Link>
      </main>
    );
  }

  const ingredients = getRecipeIngredients(recipe);
  const steps = getRecipeSteps(recipe);
  const hasNutrition = [
    recipe.nutrition.calories.min,
    recipe.nutrition.proteinG.min,
    recipe.nutrition.carbohydratesG.min,
    recipe.nutrition.fatG.min,
    recipe.nutrition.fiberG.min,
  ].some((value) => value !== null);
  const macros = [
    recipe.nutrition.calories.min !== null
      ? `${formatRange(recipe.nutrition.calories)} kcal`
      : null,
    recipe.nutrition.proteinG.min !== null
      ? `${formatRange(recipe.nutrition.proteinG, "g")} protein`
      : null,
    recipe.nutrition.carbohydratesG.min !== null
      ? `${formatRange(recipe.nutrition.carbohydratesG, "g")} carbs`
      : null,
    recipe.nutrition.fatG.min !== null
      ? `${formatRange(recipe.nutrition.fatG, "g")} fat`
      : null,
    recipe.nutrition.fiberG.min !== null
      ? `${formatRange(recipe.nutrition.fiberG, "g")} fiber`
      : null,
  ].filter(Boolean);

  return (
    <main className={styles.page}>
      <Link href="/browse" className={styles.backLink}>
        <ArrowLeft aria-hidden="true" size={16} />
        Back to library
      </Link>

      <article>
        <header className={`${styles.hero} ${!recipe.media.heroImage ? styles.heroNoImage : ""}`}>
          {recipe.media.heroImage && (
            <div
              className={styles.heroImage}
              role="img"
              aria-label={recipe.title}
              style={{ backgroundImage: `url("${recipe.media.heroImage}")` }}
            />
          )}

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              {[...recipe.classification.dish, ...recipe.classification.formats].length
                ? [...recipe.classification.dish, ...recipe.classification.formats].join(" · ")
                : "Recipe"}
            </p>

            <h1>{recipe.title}</h1>

            {(recipe.source.author || recipe.source.publication || recipe.source.type) && (
              <p className={styles.byline}>
                {recipe.source.author && <span>{recipe.source.author}</span>}
                {recipe.source.author && (recipe.source.publication || recipe.source.type) && <span aria-hidden="true">·</span>}
                {(recipe.source.publication || recipe.source.type) && (
                  <span>{recipe.source.publication || recipe.source.type}</span>
                )}
              </p>
            )}

            {recipe.source.originalUrl && (
              <a
                className={styles.sourceLink}
                href={recipe.source.originalUrl}
                rel="noreferrer"
                target="_blank"
              >
                View original recipe
                <ExternalLink aria-hidden="true" size={15} />
              </a>
            )}

            {recipe.summary && <p className={styles.description}>{recipe.summary}</p>}

            <div className={styles.metaRow}>
              {recipe.yield.timeDisplay && (
                <span><Clock3 aria-hidden="true" size={17} />{recipe.yield.timeDisplay}</span>
              )}
              {recipe.yield.servingsDisplay && (
                <span><Users aria-hidden="true" size={17} />{recipe.yield.servingsDisplay}</span>
              )}
            </div>
          </div>
        </header>

        <section aria-label="Recipe actions" className={styles.actionStrip}>
          <RecipeQuickActions
            onChange={(updated) =>
              setRecipe({
                ...updated,
                personal: {
                  ...updated.personal,
                  privateNotes: recipe.personal.privateNotes,
                },
              })
            }
            recipe={recipe}
            variant="strip"
          />

          <span className={styles.stripSpacer} />

          {macros.length > 0 && (
            <p className={styles.macros}>{macros.join(" · ")}</p>
          )}

          {user && (
            <button
              aria-pressed={Boolean(thisWeekItemId)}
              className={styles.addWeekButton}
              disabled={planningBusy}
              onClick={() => void toggleThisWeek()}
              type="button"
            >
              <CalendarPlus aria-hidden="true" size={15} />
              {thisWeekItemId ? "Remove from this week" : "Add to this week"}
            </button>
          )}

          {isAdmin && (
            <Link className={styles.editLink} href={`/recipes/${recipe.slug}/edit`}>
              <Pencil aria-hidden="true" size={14} />
              Edit recipe
            </Link>
          )}

          {saveError && <p className={styles.saveError}>{saveError}</p>}
        </section>

        <div className={styles.recipeBody}>
          <aside className={styles.ingredients}>
            <div className={styles.stickyInner}>
              <h2>Ingredients</h2>
              {ingredients.length ? (
                recipe.ingredientSections.map((section) => (
                  <section className={styles.ingredientSection} key={section.id}>
                    {section.title && <h3>{section.title}</h3>}
                    <ul>
                      {section.items.map((item) => (
                        <li key={item.id}>
                          <label>
                            <input type="checkbox" />
                            <span>{ingredientDisplayLine(item) || item.originalLine}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              ) : (
                <p>No ingredients provided.</p>
              )}
            </div>
          </aside>

          <section className={styles.method}>
            <h2>Method</h2>

            {steps.length ? (
              <ol className={styles.steps}>
                {steps.map((step, index) => (
                  <li key={step.id}>
                    <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      {step.title && <h3>{step.title}</h3>}
                      <p>{step.body || "No instructions provided."}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No method provided.</p>
            )}

            {recipe.servingSuggestion && (
              <div className={styles.editorialNote}>
                <p className={styles.noteLabel}>Serving suggestion</p>
                <p>{recipe.servingSuggestion}</p>
              </div>
            )}

            {isAdmin && (
              <div className={styles.privateNote}>
                <label htmlFor="private-notes">Private notes</label>
                <textarea
                  id="private-notes"
                  onChange={(event) => setPrivateNotesDraft(event.target.value)}
                  placeholder="What would you change next time?"
                  value={privateNotesDraft}
                />
                <div className={styles.privateNoteActions}>
                  <p>Only visible when you are signed in.</p>
                  <button
                    disabled={saving}
                    onClick={() =>
                      void updatePersonal({
                        privateNotes: privateNotesDraft.trim()
                          ? privateNotesDraft
                          : null,
                      })
                    }
                    type="button"
                  >
                    {saving ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
