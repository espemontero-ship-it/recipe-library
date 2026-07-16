"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock3, Share2, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getStoredRecipe } from "@/lib/browserRecipeStorage";
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

function Stars({ value }: { value: number | null }) {
  const rating = value ?? 0;
  return (
    <span className={styles.stars} aria-label={rating ? `${rating} out of 5 stars` : "Not rated"}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          aria-hidden="true"
          fill={index < rating ? "currentColor" : "none"}
          key={index}
          size={15}
        />
      ))}
    </span>
  );
}

export default function RecipePage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);

  useEffect(() => {
    setRecipe(getStoredRecipe(params.id));
  }, [params.id]);

  if (recipe === undefined) {
    return <main className={styles.messagePage}>Loading recipe…</main>;
  }

  if (!recipe) {
    return (
      <main className={styles.messagePage}>
        <p className={styles.eyebrow}>Recipe not found</p>
        <h1>This recipe is not stored in this browser.</h1>
        <Link href="/browse">Return to the library</Link>
      </main>
    );
  }

  const ingredients = getRecipeIngredients(recipe);
  const steps = getRecipeSteps(recipe);
  const image =
    recipe.media.heroImage ||
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1800&q=88";

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
          <button type="button" className={styles.darkButton}>Edit recipe</button>
        </div>
      </div>

      <article>
        <header className={styles.hero}>
          <div
            className={styles.heroImage}
            role="img"
            aria-label={recipe.title}
            style={{ backgroundImage: `url("${image}")` }}
          />

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              {recipe.classification.mainIngredients.length
                ? recipe.classification.mainIngredients.join(" · ")
                : "Recipe"}
            </p>

            <h1>{recipe.title}</h1>

            {(recipe.source.author || recipe.source.publication) && (
              <p className={styles.byline}>
                {recipe.source.author && <span>{recipe.source.author}</span>}
                {recipe.source.author && recipe.source.publication && <span aria-hidden="true">·</span>}
                {recipe.source.publication && <span>{recipe.source.publication}</span>}
              </p>
            )}

            {recipe.summary && <p className={styles.description}>{recipe.summary}</p>}

            <div className={styles.metaRow}>
              {recipe.yield.timeDisplay && (
                <span><Clock3 aria-hidden="true" size={17} />{recipe.yield.timeDisplay}</span>
              )}
              {recipe.yield.servingsDisplay && (
                <span><Users aria-hidden="true" size={17} />{recipe.yield.servingsDisplay} servings</span>
              )}
            </div>

            <div className={styles.personalRow}>
              <span className={styles.status}>{statusLabel(recipe.personal.status)}</span>
              <Stars value={recipe.personal.rating} />
            </div>
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
          </section>
        </div>
      </article>
    </main>
  );
}
