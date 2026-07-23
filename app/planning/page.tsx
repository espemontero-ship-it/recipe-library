"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Minus,
  MoveRight,
  Plus,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RecipeQuickActions } from "@/components/RecipeQuickActions";
import { subscribeToPersonalState } from "@/lib/personalRecipeState";
import { formatRange, type Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import {
  clearPlanningWeek,
  formatPlanningWeekLabel,
  getPlanning,
  getPlanningWeekOptions,
  getRecipeDefaultServings,
  getWeekStart,
  movePlanningItem,
  removePlanningItem,
  subscribeToPlanning,
  updatePlanningItem,
  type PlanningItem,
} from "@/lib/planning";
import { regenerateShoppingWeekIfExists } from "@/lib/shoppingList";
import styles from "./planning.module.css";

type PlannedRecipe = {
  recipe: Recipe;
  plan: PlanningItem;
};

type PlanningGroup = {
  weekStart: string;
  label: string;
  items: PlannedRecipe[];
};

function formatServings(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatWeekRange(weekStart: string) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day, 12);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export default function PlanningPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<PlanningItem[]>([]);
  const [personalVersion, setPersonalVersion] = useState(0);
  const [customMoveItemId, setCustomMoveItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refreshPlan = async () => {
      try {
        const items = await getPlanning();
        if (active) setPlan(items);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load Planning.");
        }
      }
    };
    void refreshPlan();
    const unsubscribe = subscribeToPlanning(() => void refreshPlan());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(
    () =>
      subscribeToPersonalState(() =>
        setPersonalVersion((version) => version + 1),
      ),
    [],
  );


  useEffect(() => {
    let active = true;

    getSupabaseRecipes()
      .then((items) => {
        if (active) setRecipes(items);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load recipes.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const plannedRecipes = useMemo<PlannedRecipe[]>(() => {
    const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    return plan
      .map((item) => {
        const recipe = recipesById.get(item.recipeId);
        return recipe ? { recipe, plan: item } : null;
      })
      .filter((item): item is PlannedRecipe => Boolean(item));
  }, [personalVersion, plan, recipes]);

  const groups = useMemo<PlanningGroup[]>(() => {
    const grouped = new Map<string, PlannedRecipe[]>();
    for (const item of plannedRecipes) {
      const existing = grouped.get(item.plan.weekStart) ?? [];
      existing.push(item);
      grouped.set(item.plan.weekStart, existing);
    }

    return Array.from(grouped.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([weekStart, items]) => ({
        weekStart,
        label: formatPlanningWeekLabel(weekStart),
        items: items.sort((a, b) =>
          a.plan.addedAt.localeCompare(b.plan.addedAt),
        ),
      }));
  }, [plannedRecipes]);

  const shoppingCount = plannedRecipes.filter(
    ({ plan: item }) => item.includeInShopping,
  ).length;
  const currentWeekCount = plannedRecipes.filter(
    ({ plan: item }) => item.weekStart === getWeekStart(),
  ).length;
  const weekOptions = getPlanningWeekOptions(12);

  async function regenerateWeek(weekStart: string) {
    await regenerateShoppingWeekIfExists(recipes, weekStart);
  }

  async function changeServings(item: PlanningItem, nextValue: number) {
    try {
      await updatePlanningItem(item.id, {
        servings: Math.max(0.5, Math.round(nextValue * 10) / 10),
      });
      await regenerateWeek(item.weekStart);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update servings.");
    }
  }

  async function moveItem(item: PlanningItem, targetWeek: string) {
    if (targetWeek === item.weekStart) return;
    try {
      let result = await movePlanningItem(item.id, targetWeek);
      if (result.duplicate) {
        const replace = window.confirm(
          "This recipe is already in that week. Replace the existing entry with this one and keep these servings?",
        );
        if (!replace) return;
        result = await movePlanningItem(item.id, targetWeek, true);
      }
      if (result.moved) {
        await Promise.all([
          regenerateWeek(item.weekStart),
          regenerateWeek(targetWeek),
        ]);
      }
      setCustomMoveItemId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not move the recipe.");
    }
  }

  function updateRecipeInList(updated: Recipe) {
    setRecipes((current) =>
      current.map((recipe) => (recipe.id === updated.id ? updated : recipe)),
    );
    setPersonalVersion((version) => version + 1);
  }

  async function changeShoppingInclusion(
    item: PlanningItem,
    includeInShopping: boolean,
  ) {
    try {
      await updatePlanningItem(item.id, { includeInShopping });
      await regenerateWeek(item.weekStart);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update the shopping list.",
      );
    }
  }

  async function removeItem(item: PlanningItem) {
    try {
      await removePlanningItem(item.id);
      await regenerateWeek(item.weekStart);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not remove the recipe.",
      );
    }
  }

  async function confirmClearWeek(group: PlanningGroup) {
    if (
      window.confirm(
        `Remove all ${group.items.length} recipe${group.items.length === 1 ? "" : "s"} from ${group.label.toLowerCase()}?`,
      )
    ) {
      try {
        await clearPlanningWeek(group.weekStart);
        await regenerateWeek(group.weekStart);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not clear this week.");
      }
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Weekend cooking plans</p>
          <h1>Planning</h1>
          <p className={styles.intro}>
            Recipes are added to this week by default. Adjust servings now and
            move anything you postpone to a future week.
          </p>
        </div>

        <Link className={styles.browseLink} href="/browse?plan=1">
          Add recipes
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      </header>

      {!loading && !error && plannedRecipes.length > 0 && (
        <section className={styles.summary} aria-label="Planning summary">
          <div>
            <span>This week</span>
            <strong>{currentWeekCount}</strong>
          </div>
          <div>
            <span>Total planned</span>
            <strong>{plannedRecipes.length}</strong>
          </div>
          <div>
            <span>Marked for shopping</span>
            <strong>{shoppingCount}</strong>
          </div>
        </section>
      )}

      {loading ? (
        <section className={styles.empty}>
          <h2>Loading your planning…</h2>
        </section>
      ) : error ? (
        <section className={styles.empty}>
          <h2>Could not load the recipe library.</h2>
          <p>{error}</p>
        </section>
      ) : groups.length ? (
        <div className={styles.groups}>
          {groups.map((group) => {
            const groupShoppingCount = group.items.filter(
              ({ plan: item }) => item.includeInShopping,
            ).length;

            return (
              <section className={styles.weekSection} key={group.weekStart}>
                <header className={styles.weekHeader}>
                  <div>
                    <p>{formatWeekRange(group.weekStart)}</p>
                    <h2>{group.label}</h2>
                  </div>
                  <div className={styles.weekActions}>
                    <span>
                      {group.items.length} recipe{group.items.length === 1 ? "" : "s"}
                    </span>
                    <button
                      onClick={() => void confirmClearWeek(group)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      Clear week
                    </button>
                  </div>
                </header>

                <div className={styles.planList}>
                  {group.items.map(({ recipe, plan: item }, index) => {
                    const originalServings = getRecipeDefaultServings(recipe);
                    const hasDetectedServings = Boolean(
                      recipe.yield.servings || recipe.yield.servingsDisplay,
                    );
                    const options = weekOptions.some(
                      (option) => option.weekStart === item.weekStart,
                    )
                      ? weekOptions
                      : [
                          {
                            weekStart: item.weekStart,
                            label: formatPlanningWeekLabel(item.weekStart),
                          },
                          ...weekOptions,
                        ];

                    return (
                      <article className={styles.planCard} key={item.id}>
                        <div className={styles.order} aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <Link
                          aria-label={`Open ${recipe.title}`}
                          className={`${styles.recipeImage} ${
                            recipe.media.heroImage ? "" : styles.recipeImageEmpty
                          }`}
                          href={`/recipes/${recipe.slug}`}
                          style={
                            recipe.media.heroImage
                              ? {
                                  backgroundImage: `url("${recipe.media.heroImage}")`,
                                }
                              : undefined
                          }
                        >
                          {!recipe.media.heroImage && (
                            <CalendarDays aria-hidden="true" size={34} />
                          )}
                        </Link>

                        <div className={styles.recipeCopy}>
                          <p className={styles.source}>
                            {[recipe.source.author, recipe.source.type]
                              .filter(Boolean)
                              .join(" · ") || "Recipe"}
                          </p>
                          <Link href={`/recipes/${recipe.slug}`}>
                            <h3>{recipe.title}</h3>
                          </Link>
                          <div className={styles.meta}>
                            {recipe.nutrition.calories.min !== null && (
                              <span>
                                {formatRange(recipe.nutrition.calories)} kcal
                              </span>
                            )}
                            {recipe.yield.timeDisplay && (
                              <span>{recipe.yield.timeDisplay}</span>
                            )}
                          </div>
                          <div className={styles.recipeQuickActions}>
                            <RecipeQuickActions
                              onChange={updateRecipeInList}
                              recipe={recipe}
                              showCookedLabel
                            />
                          </div>
                        </div>

                        <div className={styles.servingsPanel}>
                          <div className={styles.controlLabel}>
                            <span>Servings to cook</span>
                            <small>
                              {hasDetectedServings
                                ? `Recipe originally serves ${formatServings(originalServings)}`
                                : "Not stated in the recipe · defaulted to 1"}
                            </small>
                          </div>

                          <div className={styles.servingsControl}>
                            <button
                              aria-label={`Reduce servings for ${recipe.title}`}
                              disabled={item.servings <= 0.5}
                              onClick={() =>
                                void changeServings(item, item.servings - 0.5)
                              }
                              type="button"
                            >
                              <Minus aria-hidden="true" size={17} />
                            </button>
                            <input
                              aria-label={`Servings to cook for ${recipe.title}`}
                              min="0.5"
                              onChange={(event) =>
                                void changeServings(item, Number(event.target.value))
                              }
                              step="0.5"
                              type="number"
                              value={item.servings}
                            />
                            <button
                              aria-label={`Increase servings for ${recipe.title}`}
                              onClick={() =>
                                void changeServings(item, item.servings + 0.5)
                              }
                              type="button"
                            >
                              <Plus aria-hidden="true" size={17} />
                            </button>
                          </div>
                        </div>

                        <div className={styles.planningPanel}>
                          <label className={styles.moveControl}>
                            <span>
                              <MoveRight aria-hidden="true" size={15} />
                              Move to
                            </span>
                            <select
                              aria-label={`Move ${recipe.title} to another week`}
                              onChange={(event) => {
                                if (event.target.value === "__custom__") {
                                  setCustomMoveItemId(item.id);
                                } else {
                                  void moveItem(item, event.target.value);
                                }
                              }}
                              value={item.weekStart}
                            >
                              {options.map((option) => (
                                <option
                                  key={option.weekStart}
                                  value={option.weekStart}
                                >
                                  {option.label}
                                </option>
                              ))}
                              <option value="__custom__">Choose a date…</option>
                            </select>
                          </label>

                          {customMoveItemId === item.id && (
                            <label className={styles.customDate}>
                              <span>Any date in the destination week</span>
                              <input
                                autoFocus
                                min={getWeekStart()}
                                onChange={(event) => {
                                  if (event.target.value) {
                                    void moveItem(item, event.target.value);
                                  }
                                }}
                                type="date"
                              />
                            </label>
                          )}

                          <label className={styles.shoppingControl}>
                            <input
                              checked={item.includeInShopping}
                              onChange={(event) =>
                                void changeShoppingInclusion(
                                  item,
                                  event.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                            <span className={styles.checkmark}>
                              {item.includeInShopping && (
                                <Check aria-hidden="true" size={15} />
                              )}
                            </span>
                            <span>
                              <strong>Include in shopping list</strong>
                              <small>
                                {item.includeInShopping
                                  ? "Its ingredients will be included"
                                  : "Keep as an idea only"}
                              </small>
                            </span>
                          </label>

                          <button
                            className={styles.removeButton}
                            onClick={() => void removeItem(item)}
                            type="button"
                          >
                            Remove from planning
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <footer className={styles.nextStep}>
                  <div>
                    <ShoppingBasket aria-hidden="true" size={22} />
                    <p>
                      <strong>
                        {groupShoppingCount} recipe
                        {groupShoppingCount === 1 ? "" : "s"} ready for shopping
                      </strong>
                      <span>
                        Review the adjusted ingredients before creating this
                        week’s list.
                      </span>
                    </p>
                  </div>
                  {groupShoppingCount > 0 ? (
                    <Link href={`/shopping?week=${group.weekStart}`}>
                      Prepare shopping list
                    </Link>
                  ) : (
                    <button disabled type="button">
                      Prepare shopping list
                    </button>
                  )}
                </footer>
              </section>
            );
          })}
        </div>
      ) : (
        <section className={styles.empty}>
          <CalendarDays aria-hidden="true" size={36} />
          <h2>No recipes planned yet.</h2>
          <p>
            Select several recipes from the library. They will be added to this
            week first and can be moved later.
          </p>
          <Link href="/browse?plan=1">Choose recipes</Link>
        </section>
      )}
    </main>
  );
}
