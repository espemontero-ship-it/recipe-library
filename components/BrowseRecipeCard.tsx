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
import { getRecipeIngredients, type Recipe } from "@/lib/recipeModel";
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

export function BrowseRecipeCard({
  recipe,
  view,
  planningMode,
  selected,
  alreadyPlanned,
  onToggleSelection,
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
    .map((item) => item.originalLine.trim())
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

        {!planningMode ? (
          <div className={styles.quickActions}>
            <RecipeQuickActions
              onChange={onRecipeChange}
              recipe={recipe}
              showCookedLabel={view === "list"}
            />
          </div>
        ) : (
          <div className={styles.statusIcons} aria-label="Recipe status">
            <Heart
              aria-label={recipe.personal.favorite ? "Favorite" : "Not favorite"}
              fill={recipe.personal.favorite ? "currentColor" : "none"}
              size={17}
            />
            <CheckCircle2
              aria-label={recipe.personal.tested ? "Made" : "Not made"}
              opacity={recipe.personal.tested ? 1 : 0.4}
              size={17}
            />
            <span className={styles.staticRating}>
              {Array.from({ length: 5 }, (_, index) => (
                <Star
                  aria-hidden="true"
                  fill={index < (recipe.personal.rating ?? 0) ? "currentColor" : "none"}
                  key={index}
                  opacity={index < (recipe.personal.rating ?? 0) ? 1 : 0.4}
                  size={15}
                />
              ))}
            </span>
            {alreadyPlanned && (
              <CalendarDays aria-label="In planning" size={17} />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
