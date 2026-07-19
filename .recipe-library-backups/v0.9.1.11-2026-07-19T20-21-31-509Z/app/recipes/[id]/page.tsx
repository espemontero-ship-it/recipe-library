"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Heart,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  loadPrivateRecipeNotes,
  savePersonalState,
  subscribeToPersonalState,
} from "@/lib/personalRecipeState";
import { getSupabaseRecipe } from "@/lib/supabaseRecipes";
import {
  formatRange,
  getRecipeIngredients,
  getRecipeSteps,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./recipe.module.css";

function statusLabel(status: Recipe["personal"]["status"]) {
  return {
    to_try: "To Try",
    this_weekend: "This Weekend",
    tested: "Tested",
    favorite: "Favorite",
    discarded: "Discarded",
  }[status];
}

export default function RecipePage() {
  const params = useParams<{ id: string }>();
  const { loading: authLoading, isAdmin } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [privateNotesDraft, setPrivateNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

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
    if (!recipe || authLoading || !isAdmin) return;

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
  }, [authLoading, isAdmin, recipe?.id]);

  useEffect(
    () =>
      subscribeToPersonalState(() => {
        getSupabaseRecipe(params.id)
          .then((item) => {
            if (item) {
              setRecipe((current) => ({
                ...item,
                personal: {
                  ...item.personal,
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
    patch: Partial<
      Pick<
        Recipe["personal"],
        "favorite" | "tested" | "thisWeekend" | "rating" | "privateNotes"
      >
    >,
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
  const hasPublicState =
    recipe.personal.favorite ||
    recipe.personal.tested ||
    recipe.personal.thisWeekend ||
    recipe.personal.rating !== null;

  return (
    <main className={styles.page}>
      <div className={styles.utilityBar}>
        <Link href="/browse" className={styles.backLink}>
          <ArrowLeft aria-hidden="true" size={17} />
          Back to library
        </Link>

        <div className={styles.utilityActions}>
          <button type="button" className={styles.quietButton}>
            <Share2 aria-hidden="true" size={16} />
            Share
          </button>
        </div>
      </div>

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

            {(recipe.source.author || recipe.source.type) && (
              <p className={styles.byline}>
                {recipe.source.author && <span>{recipe.source.author}</span>}
                {recipe.source.author && recipe.source.type && <span aria-hidden="true">·</span>}
                {recipe.source.type && <span>{recipe.source.type}</span>}
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

            {(isAdmin || hasPublicState) && (
              <section aria-label="Recipe state" className={styles.personalPanel}>
                {isAdmin ? (
                  <>
                    <div className={styles.personalButtons}>
                      <button
                        aria-pressed={recipe.personal.favorite}
                        className={recipe.personal.favorite ? styles.personalButtonActive : ""}
                        disabled={saving}
                        onClick={() =>
                          void updatePersonal({ favorite: !recipe.personal.favorite })
                        }
                        type="button"
                      >
                        <Heart
                          aria-hidden="true"
                          fill={recipe.personal.favorite ? "currentColor" : "none"}
                          size={17}
                        />
                        Favorite
                      </button>
                      <button
                        aria-pressed={recipe.personal.tested}
                        className={recipe.personal.tested ? styles.personalButtonActive : ""}
                        disabled={saving}
                        onClick={() =>
                          void updatePersonal({ tested: !recipe.personal.tested })
                        }
                        type="button"
                      >
                        <CheckCircle2 aria-hidden="true" size={17} />
                        Tested
                      </button>
                      <button
                        aria-pressed={recipe.personal.thisWeekend}
                        className={recipe.personal.thisWeekend ? styles.personalButtonActive : ""}
                        disabled={saving}
                        onClick={() =>
                          void updatePersonal({
                            thisWeekend: !recipe.personal.thisWeekend,
                          })
                        }
                        type="button"
                      >
                        <CalendarDays aria-hidden="true" size={17} />
                        This weekend
                      </button>
                    </div>

                    <div className={styles.ratingControl}>
                      <span>Rating</span>
                      <div>
                        {Array.from({ length: 5 }, (_, index) => {
                          const value = index + 1;
                          const selected = value <= (recipe.personal.rating ?? 0);

                          return (
                            <button
                              aria-label={`${value} star${value === 1 ? "" : "s"}`}
                              aria-pressed={recipe.personal.rating === value}
                              disabled={saving}
                              key={value}
                              onClick={() =>
                                void updatePersonal({
                                  rating:
                                    recipe.personal.rating === value ? null : value,
                                })
                              }
                              type="button"
                            >
                              <Star
                                aria-hidden="true"
                                fill={selected ? "currentColor" : "none"}
                                size={20}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.personalSummary}>
                      <span className={styles.status}>
                        {statusLabel(recipe.personal.status)}
                      </span>
                      <span>{saving ? "Saving…" : "Synced with your account"}</span>
                    </div>
                    {saveError && <p className={styles.saveError}>{saveError}</p>}
                  </>
                ) : (
                  <div className={styles.publicState}>
                    {recipe.personal.favorite && (
                      <span><Heart aria-hidden="true" fill="currentColor" size={16} />Favorite</span>
                    )}
                    {recipe.personal.tested && (
                      <span><CheckCircle2 aria-hidden="true" size={16} />Tested</span>
                    )}
                    {recipe.personal.thisWeekend && (
                      <span><CalendarDays aria-hidden="true" size={16} />This weekend</span>
                    )}
                    {recipe.personal.rating !== null && (
                      <span><Star aria-hidden="true" fill="currentColor" size={16} />{recipe.personal.rating}/5</span>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </header>

        <section className={styles.nutrition} aria-label="Nutrition per serving">
          <div><span>Calories</span><strong>{formatRange(recipe.nutrition.calories)}</strong></div>
          <div><span>Protein</span><strong>{formatRange(recipe.nutrition.proteinG, " g")}</strong></div>
          <div><span>Carbohydrates</span><strong>{formatRange(recipe.nutrition.carbohydratesG, " g")}</strong></div>
          <div><span>Fat</span><strong>{formatRange(recipe.nutrition.fatG, " g")}</strong></div>
          <div><span>Fiber</span><strong>{formatRange(recipe.nutrition.fiberG, " g")}</strong></div>
        </section>

        <div className={styles.recipeBody}>
          <aside className={styles.ingredients}>
            <div className={styles.stickyInner}>
              <p className={styles.sectionNumber}>01</p>
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
                            <span>{item.originalLine}</span>
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
            <p className={styles.sectionNumber}>02</p>
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
