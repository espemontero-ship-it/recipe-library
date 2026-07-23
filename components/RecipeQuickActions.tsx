"use client";

import { CalendarCheck2, CalendarPlus, CheckCircle2, Heart, Star } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { savePersonalState } from "@/lib/personalRecipeState";
import type { Recipe } from "@/lib/recipeModel";
import styles from "./RecipeQuickActions.module.css";

type Props = {
  recipe: Recipe;
  onChange?: (recipe: Recipe) => void;
  showCookedLabel?: boolean;
  inThisWeek?: boolean;
  onToggleThisWeek?: () => void | Promise<void>;
  planningBusy?: boolean;
};

export function RecipeQuickActions({
  recipe,
  onChange,
  showCookedLabel = true,
  inThisWeek = false,
  onToggleThisWeek,
  planningBusy = false,
}: Props) {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editable = isAdmin && !authLoading;

  async function updatePersonal(
    patch: Partial<
      Pick<Recipe["personal"], "favorite" | "tested" | "rating">
    >,
  ) {
    if (!editable || busy) return;
    setBusy(true);
    setError("");

    try {
      const updated = await savePersonalState(recipe, patch);
      onChange?.(updated);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save the change.",
      );
    } finally {
      setBusy(false);
    }
  }

  const madeLabel = recipe.personal.tested ? "Made" : "Mark made";

  return (
    <div className={styles.actions} onClick={(event) => event.stopPropagation()}>
      {onToggleThisWeek && user && (
        <button
          aria-label={
            inThisWeek
              ? `Remove ${recipe.title} from this week`
              : `Add ${recipe.title} to this week`
          }
          aria-pressed={inThisWeek}
          className={`${styles.iconButton} ${
            inThisWeek ? styles.active : ""
          }`}
          disabled={busy || planningBusy}
          onClick={() => void onToggleThisWeek()}
          title={inThisWeek ? "In this week" : "Add to this week"}
          type="button"
        >
          {inThisWeek ? (
            <CalendarCheck2 aria-hidden="true" size={17} />
          ) : (
            <CalendarPlus aria-hidden="true" size={17} />
          )}
        </button>
      )}

      <button
        aria-label={
          recipe.personal.favorite ? "Remove from favorites" : "Add to favorites"
        }
        aria-pressed={recipe.personal.favorite}
        className={`${styles.iconButton} ${
          recipe.personal.favorite ? styles.active : ""
        }`}
        disabled={!editable || busy}
        onClick={() =>
          void updatePersonal({ favorite: !recipe.personal.favorite })
        }
        title={recipe.personal.favorite ? "Favorite" : "Add to favorites"}
        type="button"
      >
        <Heart
          aria-hidden="true"
          fill={recipe.personal.favorite ? "currentColor" : "none"}
          size={17}
        />
      </button>

      <button
        aria-label={
          recipe.personal.tested
            ? `Mark ${recipe.title} as not made`
            : `Mark ${recipe.title} as made`
        }
        aria-pressed={recipe.personal.tested}
        className={`${styles.cookedButton} ${
          recipe.personal.tested ? styles.active : ""
        }`}
        disabled={!editable || busy}
        onClick={() =>
          void updatePersonal({ tested: !recipe.personal.tested })
        }
        title={recipe.personal.tested ? "Made" : "Mark made"}
        type="button"
      >
        <CheckCircle2 aria-hidden="true" size={17} />
        {showCookedLabel && <span>{madeLabel}</span>}
      </button>

      <div aria-label="Recipe rating" className={styles.rating}>
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          const selected = value <= (recipe.personal.rating ?? 0);
          return (
            <button
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              aria-pressed={recipe.personal.rating === value}
              className={`${styles.starButton} ${selected ? styles.active : ""}`}
              disabled={!editable || busy}
              key={value}
              onClick={() =>
                void updatePersonal({
                  rating: recipe.personal.rating === value ? null : value,
                })
              }
              title={`${value} star${value === 1 ? "" : "s"}`}
              type="button"
            >
              <Star
                aria-hidden="true"
                fill={selected ? "currentColor" : "none"}
                size={16}
              />
            </button>
          );
        })}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
