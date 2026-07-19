"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRange, type Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import {
  clearWeeklyPlan,
  getRecipeDefaultServings,
  getWeeklyPlan,
  removeRecipeFromWeeklyPlan,
  subscribeToWeeklyPlan,
  updateWeeklyPlanItem,
  type WeeklyPlanItem,
} from "@/lib/weeklyPlan";
import styles from "./week.module.css";

type PlannedRecipe = {
  recipe: Recipe;
  plan: WeeklyPlanItem;
};

function formatServings(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function WeekPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<WeeklyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPlan(getWeeklyPlan());
    return subscribeToWeeklyPlan(() => setPlan(getWeeklyPlan()));
  }, []);

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
  }, [plan, recipes]);

  const shoppingCount = plannedRecipes.filter(
    ({ plan: item }) => item.includeInShopping,
  ).length;

  function changeServings(item: WeeklyPlanItem, nextValue: number) {
    updateWeeklyPlanItem(item.recipeId, {
      servings: Math.max(0.5, Math.round(nextValue * 10) / 10),
    });
  }

  function confirmClear() {
    if (!plannedRecipes.length) return;
    if (window.confirm("Remove every recipe from this week?")) {
      clearWeeklyPlan();
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Weekend cooking plan</p>
          <h1>This week</h1>
          <p className={styles.intro}>
            Choose what you are cooking, adjust the servings, then decide which
            recipes should contribute ingredients to the shopping list.
          </p>
        </div>

        <Link className={styles.browseLink} href="/browse?plan=1">
          Add recipes
          <ChevronRight aria-hidden="true" size={17} />
        </Link>
      </header>

      {!loading && !error && plannedRecipes.length > 0 && (
        <section className={styles.summary} aria-label="Weekly plan summary">
          <div>
            <span>Recipes planned</span>
            <strong>{plannedRecipes.length}</strong>
          </div>
          <div>
            <span>For the shopping list</span>
            <strong>{shoppingCount}</strong>
          </div>
          <button onClick={confirmClear} type="button">
            <Trash2 aria-hidden="true" size={16} />
            Clear week
          </button>
        </section>
      )}

      {loading ? (
        <section className={styles.empty}>
          <h2>Loading your plan…</h2>
        </section>
      ) : error ? (
        <section className={styles.empty}>
          <h2>Could not load the recipe library.</h2>
          <p>{error}</p>
        </section>
      ) : plannedRecipes.length ? (
        <section className={styles.planList}>
          {plannedRecipes.map(({ recipe, plan: item }, index) => {
            const originalServings = getRecipeDefaultServings(recipe);
            const hasDetectedServings = Boolean(
              recipe.yield.servings || recipe.yield.servingsDisplay,
            );

            return (
              <article className={styles.planCard} key={recipe.id}>
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
                      ? { backgroundImage: `url("${recipe.media.heroImage}")` }
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
                    <h2>{recipe.title}</h2>
                  </Link>
                  <div className={styles.meta}>
                    {recipe.nutrition.calories.min !== null && (
                      <span>{formatRange(recipe.nutrition.calories)} kcal</span>
                    )}
                    {recipe.yield.timeDisplay && (
                      <span>{recipe.yield.timeDisplay}</span>
                    )}
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
                      onClick={() => changeServings(item, item.servings - 0.5)}
                      type="button"
                    >
                      <Minus aria-hidden="true" size={17} />
                    </button>
                    <input
                      aria-label={`Servings to cook for ${recipe.title}`}
                      min="0.5"
                      onChange={(event) =>
                        changeServings(item, Number(event.target.value))
                      }
                      step="0.5"
                      type="number"
                      value={item.servings}
                    />
                    <button
                      aria-label={`Increase servings for ${recipe.title}`}
                      onClick={() => changeServings(item, item.servings + 0.5)}
                      type="button"
                    >
                      <Plus aria-hidden="true" size={17} />
                    </button>
                  </div>
                </div>

                <div className={styles.shoppingPanel}>
                  <label>
                    <input
                      checked={item.includeInShopping}
                      onChange={(event) =>
                        updateWeeklyPlanItem(item.recipeId, {
                          includeInShopping: event.target.checked,
                        })
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
                    onClick={() => removeRecipeFromWeeklyPlan(item.recipeId)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}

          <footer className={styles.nextStep}>
            <div>
              <ShoppingBasket aria-hidden="true" size={22} />
              <p>
                <strong>{shoppingCount} recipes ready for shopping</strong>
                <span>
                  Ingredient review and the final shopping list come in the next
                  deliverable.
                </span>
              </p>
            </div>
            <button disabled type="button">
              Prepare shopping list
            </button>
          </footer>
        </section>
      ) : (
        <section className={styles.empty}>
          <CalendarDays aria-hidden="true" size={36} />
          <h2>No recipes planned yet.</h2>
          <p>
            Select several recipes from the library and add them here in one go.
          </p>
          <Link href="/browse?plan=1">Choose recipes</Link>
        </section>
      )}
    </main>
  );
}
