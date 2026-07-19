"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Heart,
  ImageOff,
  Star,
} from "lucide-react";
import { RecipeQuickActions } from "@/components/RecipeQuickActions";
import {
  formatRange,
  getRecipeIngredients,
  getRecipeSteps,
  type Recipe,
} from "@/lib/recipeModel";
import styles from "./BrowseRecipeCard.module.css";

type Props = {
  recipe: Recipe;
  view: "grid" | "list";
  planningMode: boolean;
  selected: boolean;
  alreadyPlanned: boolean;
  onToggleSelection: () => void;
  onRecipeChange: (recipe: Recipe) => void;
};

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function BrowseRecipeCard({
  recipe,
  view,
  planningMode,
  selected,
  alreadyPlanned,
  onToggleSelection,
  onRecipeChange,
}: Props) {
  const tags = [
    ...recipe.classification.dish,
    ...recipe.classification.formats,
    ...recipe.classification.mealTypes,
  ].slice(0, 3);
  const ingredients = getRecipeIngredients(recipe);
  const previewText =
    recipe.summary ||
    recipe.publicNotes ||
    getRecipeSteps(recipe)[0]?.body ||
    null;
  const visibleIngredientCount = view === "list" ? 7 : 5;
  const visibleIngredients = ingredients.slice(0, visibleIngredientCount);
  const remainingIngredients = Math.max(
    0,
    ingredients.length - visibleIngredients.length,
  );
  const recipeHref = `/recipes/${recipe.slug}`;

  const imageStyle = recipe.media.heroImage
    ? { backgroundImage: `url("${recipe.media.heroImage}")` }
    : undefined;

  return (
    <article
      className={`${styles.shell} ${styles[view]} ${
        selected ? styles.selected : ""
      }`}
    >
      {planningMode && (
        <button
          aria-label={`${selected ? "Unselect" : "Select"} ${
            recipe.title
          } for planning`}
          aria-pressed={selected}
          className={`${styles.selectionButton} ${
            selected ? styles.selectionButtonActive : ""
          }`}
          disabled={alreadyPlanned}
          onClick={onToggleSelection}
          type="button"
        >
          {selected || alreadyPlanned ? (
            <Check aria-hidden="true" size={17} />
          ) : null}
        </button>
      )}

      {alreadyPlanned && (
        <span className={styles.plannedBadge}>In planning</span>
      )}

      <div className={styles.card}>
        {planningMode ? (
          <button
            aria-label={`Select ${recipe.title} for planning`}
            className={`${styles.imageButton} ${
              recipe.media.heroImage ? "" : styles.imageEmpty
            }`}
            disabled={alreadyPlanned}
            onClick={onToggleSelection}
            style={imageStyle}
            type="button"
          >
            {!recipe.media.heroImage && (
              <ImageOff aria-hidden="true" size={32} />
            )}
          </button>
        ) : (
          <Link
            aria-label={`Open ${recipe.title}`}
            className={`${styles.imageLink} ${
              recipe.media.heroImage ? "" : styles.imageEmpty
            }`}
            href={recipeHref}
            style={imageStyle}
          >
            {!recipe.media.heroImage && (
              <ImageOff aria-hidden="true" size={32} />
            )}
          </Link>
        )}

        <div className={styles.body}>
          <div className={styles.topline}>
            <p className={styles.eyebrow}>
              {tags.map(humanize).join(" · ") || "Recipe"}
            </p>
            <span className={styles.stateIcons}>
              {recipe.personal.favorite && (
                <Heart aria-label="Favorite" fill="currentColor" size={16} />
              )}
              {recipe.personal.tested && (
                <CheckCircle2 aria-label="Made" size={16} />
              )}
              {recipe.personal.rating !== null && (
                <Star
                  aria-label={`${recipe.personal.rating} out of 5 stars`}
                  fill="currentColor"
                  size={16}
                />
              )}
              {alreadyPlanned && (
                <CalendarDays aria-label="In planning" size={16} />
              )}
            </span>
          </div>

          {planningMode ? (
            <button
              className={styles.titleButton}
              disabled={alreadyPlanned}
              onClick={onToggleSelection}
              type="button"
            >
              <h2>{recipe.title}</h2>
            </button>
          ) : (
            <Link className={styles.title} href={recipeHref}>
              <h2>{recipe.title}</h2>
            </Link>
          )}

          {(recipe.source.author || recipe.source.type) && (
            <p className={styles.source}>
              {[recipe.source.author, recipe.source.type]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {previewText && <p className={styles.summary}>{previewText}</p>}

          <section className={styles.ingredients} aria-label="Ingredients preview">
            <h3>Ingredients</h3>
            {visibleIngredients.length ? (
              <ul>
                {visibleIngredients.map((item) => (
                  <li key={item.id}>{item.originalLine}</li>
                ))}
                {remainingIngredients > 0 && (
                  <li className={styles.more}>
                    + {remainingIngredients} more ingredient
                    {remainingIngredients === 1 ? "" : "s"}
                  </li>
                )}
              </ul>
            ) : (
              <p className={styles.source}>No ingredients listed.</p>
            )}
          </section>

          <div className={styles.meta}>
            {recipe.nutrition.calories.min !== null && (
              <strong>{formatRange(recipe.nutrition.calories)} kcal</strong>
            )}
            {recipe.yield.servingsDisplay && (
              <span>{recipe.yield.servingsDisplay}</span>
            )}
            {recipe.yield.timeDisplay && <span>{recipe.yield.timeDisplay}</span>}
          </div>
        </div>

        {!planningMode && (
          <div className={styles.quickActions}>
            <RecipeQuickActions
              onChange={onRecipeChange}
              recipe={recipe}
              showCookedLabel
            />
          </div>
        )}
      </div>
    </article>
  );
}
