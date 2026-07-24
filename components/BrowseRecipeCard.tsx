"use client";

import Link from "next/link";
import { CalendarPlus, Check, CheckCircle2, Heart, ImageOff, Star } from "lucide-react";
import { RecipeQuickActions } from "@/components/RecipeQuickActions";
import { getRecipeIngredients, type Recipe } from "@/lib/recipeModel";
import { ingredientDisplayLine } from "@/lib/ingredientParser";
import styles from "./BrowseRecipeCard.module.css";

type Props = {
  recipe: Recipe;
  view: "grid" | "list";
  planningMode: boolean;
  selected: boolean;
  alreadyPlanned: boolean;
  inThisWeek: boolean;
  onToggleSelection: () => void;
  onToggleThisWeek: () => void | Promise<void>;
  planningBusy: boolean;
  onRecipeChange: (recipe: Recipe) => void;
};

export function BrowseRecipeCard({
  recipe,
  view,
  planningMode,
  selected,
  alreadyPlanned,
  inThisWeek,
  onToggleSelection,
  onToggleThisWeek,
  planningBusy,
  onRecipeChange,
}: Props) {
  const ingredients = getRecipeIngredients(recipe);
  const visibleIngredientCount = view === "list" ? 9 : 6;
  const visibleIngredients = ingredients.slice(0, visibleIngredientCount);
  const remainingIngredients = Math.max(
    0,
    ingredients.length - visibleIngredients.length,
  );
  const ingredientPreview = visibleIngredients
    .map((item) => ingredientDisplayLine(item) || item.originalLine.trim())
    .filter(Boolean)
    .join(", ");
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

      <div className={styles.card}>
        <div className={styles.imageWrap}>
          {alreadyPlanned && (
            <span className={styles.plannedBadge}>In planning</span>
          )}

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
                <ImageOff aria-hidden="true" size={28} />
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
                <ImageOff aria-hidden="true" size={28} />
              )}
            </Link>
          )}

          <div className={styles.overlay}>
            <span className={styles.overlayRating}>
              {recipe.personal.rating ? (
                <>
                  <Star aria-hidden="true" fill="currentColor" size={19} />
                  {recipe.personal.rating}
                </>
              ) : null}
            </span>

            {!planningMode ? (
              <RecipeQuickActions
                inThisWeek={inThisWeek}
                onChange={onRecipeChange}
                onToggleThisWeek={onToggleThisWeek}
                planningBusy={planningBusy}
                recipe={recipe}
                showCookedLabel={false}
                variant="overlay"
              />
            ) : (
              <div aria-label="Recipe status" className={styles.overlayStatus}>
                <Heart
                  aria-label={recipe.personal.favorite ? "Favorite" : "Not favorite"}
                  fill={recipe.personal.favorite ? "currentColor" : "none"}
                  size={19}
                />
                <CheckCircle2
                  aria-label={recipe.personal.tested ? "Made" : "Not made"}
                  opacity={recipe.personal.tested ? 1 : 0.5}
                  size={19}
                />
                <CalendarPlus
                  aria-label={alreadyPlanned ? "In planning" : "Not planned"}
                  opacity={alreadyPlanned ? 1 : 0.5}
                  size={19}
                />
              </div>
            )}
          </div>
        </div>

        <div className={styles.body}>
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

          <p className={styles.ingredientPreview}>
            {ingredientPreview || "No ingredients listed."}
            {remainingIngredients > 0 && (
              <span className={styles.more}>
                {ingredientPreview ? ", " : ""}+{remainingIngredients} more
              </span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
