"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getStoredRecipes } from "@/lib/browserRecipeStorage";
import {
  formatRange,
  getRecipeIngredients,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./browse.module.css";

export default function BrowsePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setRecipes(getStoredRecipes());
    refresh();
    window.addEventListener("recipe-library:updated", refresh);
    return () => window.removeEventListener("recipe-library:updated", refresh);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return recipes;

    return recipes.filter((recipe) =>
      [
        recipe.title,
        recipe.source.author,
        recipe.source.publication,
        ...recipe.classification.mainIngredients,
        ...getRecipeIngredients(recipe).map((item) => item.originalLine),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, recipes]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Your library</p>
        <h1>Browse recipes</h1>
        <div className={styles.search}>
          <Search aria-hidden="true" size={20} />
          <input
            aria-label="Search recipes"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, ingredient, author..."
            type="search"
            value={query}
          />
        </div>
      </header>

      {filtered.length ? (
        <section className={styles.grid}>
          {filtered.map((recipe) => (
            <Link className={styles.card} href={`/recipes/${recipe.id}`} key={recipe.id}>
              <div
                className={styles.image}
                style={
                  recipe.media.heroImage
                    ? { backgroundImage: `url("${recipe.media.heroImage}")` }
                    : undefined
                }
              />
              <div className={styles.body}>
                <p>{recipe.classification.mainIngredients.join(" · ") || "Recipe"}</p>
                <h2>{recipe.title}</h2>
                {(recipe.source.author || recipe.source.publication) && (
                  <span>
                    {[recipe.source.author, recipe.source.publication]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <strong>
                  {recipe.nutrition.calories.min === null
                    ? "Nutrition not provided"
                    : `${formatRange(recipe.nutrition.calories)} kcal`}
                </strong>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className={styles.empty}>
          <h2>{recipes.length ? "No recipes match your search." : "No saved recipes yet."}</h2>
          <p>Paste a recipe and save it to add it to this browser’s library.</p>
          <Link href="/paste">Paste recipe</Link>
        </section>
      )}
    </main>
  );
}
