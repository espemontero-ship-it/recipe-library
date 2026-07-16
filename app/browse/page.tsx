"use client";

import Link from "next/link";
import {
  Grid2X2,
  Heart,
  List,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getStoredRecipes, saveRecipe } from "@/lib/browserRecipeStorage";
import {
  formatRange,
  getRecipeIngredients,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./browse.module.css";

type SortOption = "recent" | "alphabetical" | "rating";
type ViewMode = "grid" | "list";
type TestedFilter = "all" | "tested" | "not_tested";

type FacetKey =
  | "mainIngredient"
  | "dishType"
  | "method"
  | "cuisine"
  | "collection"
  | "source"
  | "author";

type FacetState = Record<FacetKey, string>;

const EMPTY_FACETS: FacetState = {
  mainIngredient: "",
  dishType: "",
  method: "",
  cuisine: "",
  collection: "",
  source: "",
  author: "",
};

function uniqueSorted(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ).sort((a, b) => a.localeCompare(b));
}

function sourceLine(recipe: Recipe) {
  return [recipe.source.author, recipe.source.publication]
    .filter(Boolean)
    .join(" · ");
}

function getSearchText(recipe: Recipe) {
  return [
    recipe.title,
    recipe.source.author,
    recipe.source.publication,
    ...recipe.classification.mainIngredients,
    ...recipe.classification.dishTypes,
    ...recipe.classification.cookingMethods,
    ...recipe.classification.cuisines,
    ...recipe.classification.collections,
    ...getRecipeIngredients(recipe).map((item) => item.originalLine),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function displayMacro(
  value: Recipe["nutrition"]["calories"],
  suffix: string,
) {
  return value.min === null ? "—" : formatRange(value, suffix);
}

function Rating({ value }: { value: number | null }) {
  const rating = value ?? 0;
  return (
    <span className={styles.rating} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          aria-hidden="true"
          fill={index < rating ? "currentColor" : "none"}
          key={index}
          size={14}
        />
      ))}
    </span>
  );
}

export default function BrowsePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [facets, setFacets] = useState<FacetState>(EMPTY_FACETS);
  const [tested, setTested] = useState<TestedFilter>("all");
  const [minimumRating, setMinimumRating] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [thisWeekendOnly, setThisWeekendOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");
  const [view, setView] = useState<ViewMode>("grid");

  useEffect(() => {
    const refresh = () => setRecipes(getStoredRecipes());
    refresh();
    window.addEventListener("recipe-library:updated", refresh);
    return () => window.removeEventListener("recipe-library:updated", refresh);
  }, []);

  const options = useMemo(
    () => ({
      mainIngredient: uniqueSorted(
        recipes.flatMap((recipe) => recipe.classification.mainIngredients),
      ),
      dishType: uniqueSorted(
        recipes.flatMap((recipe) => recipe.classification.dishTypes),
      ),
      method: uniqueSorted(
        recipes.flatMap((recipe) => recipe.classification.cookingMethods),
      ),
      cuisine: uniqueSorted(
        recipes.flatMap((recipe) => recipe.classification.cuisines),
      ),
      collection: uniqueSorted(
        recipes.flatMap((recipe) => recipe.classification.collections),
      ),
      source: uniqueSorted(
        recipes.map((recipe) => recipe.source.publication),
      ),
      author: uniqueSorted(recipes.map((recipe) => recipe.source.author)),
    }),
    [recipes],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return recipes
      .filter((recipe) => {
        if (normalized && !getSearchText(recipe).includes(normalized)) return false;
        if (
          facets.mainIngredient &&
          !recipe.classification.mainIngredients.includes(facets.mainIngredient)
        ) return false;
        if (
          facets.dishType &&
          !recipe.classification.dishTypes.includes(facets.dishType)
        ) return false;
        if (
          facets.method &&
          !recipe.classification.cookingMethods.includes(facets.method)
        ) return false;
        if (
          facets.cuisine &&
          !recipe.classification.cuisines.includes(facets.cuisine)
        ) return false;
        if (
          facets.collection &&
          !recipe.classification.collections.includes(facets.collection)
        ) return false;
        if (facets.source && recipe.source.publication !== facets.source) return false;
        if (facets.author && recipe.source.author !== facets.author) return false;
        if (tested === "tested" && !recipe.personal.tested) return false;
        if (tested === "not_tested" && recipe.personal.tested) return false;
        if ((recipe.personal.rating ?? 0) < minimumRating) return false;
        if (favoritesOnly && !recipe.personal.favorite) return false;
        if (thisWeekendOnly && !recipe.personal.thisWeekend) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "alphabetical") return a.title.localeCompare(b.title);
        if (sort === "rating") {
          return (b.personal.rating ?? 0) - (a.personal.rating ?? 0);
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [facets, favoritesOnly, minimumRating, query, recipes, sort, tested, thisWeekendOnly]);

  const hasFilters = Boolean(
    query ||
      Object.values(facets).some(Boolean) ||
      tested !== "all" ||
      minimumRating ||
      favoritesOnly ||
      thisWeekendOnly,
  );

  function setFacet(key: FacetKey, value: string) {
    setFacets((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setQuery("");
    setFacets(EMPTY_FACETS);
    setTested("all");
    setMinimumRating(0);
    setFavoritesOnly(false);
    setThisWeekendOnly(false);
  }

  function toggleFavorite(event: React.MouseEvent, recipe: Recipe) {
    event.preventDefault();
    event.stopPropagation();
    saveRecipe({
      ...recipe,
      personal: {
        ...recipe.personal,
        favorite: !recipe.personal.favorite,
      },
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTopline}>
          <div>
            <p className={styles.eyebrow}>Your library</p>
            <h1>Browse recipes</h1>
          </div>
          <Link className={styles.addButton} href="/paste">Add recipe</Link>
        </div>

        <div className={styles.searchRow}>
          <label className={styles.search}>
            <Search aria-hidden="true" size={20} />
            <input
              aria-label="Search recipes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, ingredient, author..."
              type="search"
              value={query}
            />
            {query ? (
              <button aria-label="Clear search" onClick={() => setQuery("")} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            ) : null}
          </label>

          <button
            aria-pressed={favoritesOnly}
            className={`${styles.filterButton} ${favoritesOnly ? styles.filterButtonActive : ""}`}
            onClick={() => setFavoritesOnly((current) => !current)}
            type="button"
          >
            <Heart aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} size={18} />
            Favorites
          </button>

          <button
            aria-pressed={thisWeekendOnly}
            className={`${styles.filterButton} ${thisWeekendOnly ? styles.filterButtonActive : ""}`}
            onClick={() => setThisWeekendOnly((current) => !current)}
            type="button"
          >
            This Weekend
          </button>
        </div>

        <section className={styles.facets} aria-label="Recipe filters">
          <label>
            <span>Main ingredient</span>
            <select value={facets.mainIngredient} onChange={(event) => setFacet("mainIngredient", event.target.value)}>
              <option value="">All</option>
              {options.mainIngredient.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Dish type</span>
            <select value={facets.dishType} onChange={(event) => setFacet("dishType", event.target.value)}>
              <option value="">All</option>
              {options.dishType.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Cooking method</span>
            <select value={facets.method} onChange={(event) => setFacet("method", event.target.value)}>
              <option value="">All</option>
              {options.method.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Cuisine</span>
            <select value={facets.cuisine} onChange={(event) => setFacet("cuisine", event.target.value)}>
              <option value="">All</option>
              {options.cuisine.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Collection</span>
            <select value={facets.collection} onChange={(event) => setFacet("collection", event.target.value)}>
              <option value="">All</option>
              {options.collection.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={facets.source} onChange={(event) => setFacet("source", event.target.value)}>
              <option value="">All</option>
              {options.source.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Author</span>
            <select value={facets.author} onChange={(event) => setFacet("author", event.target.value)}>
              <option value="">All</option>
              {options.author.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Tested</span>
            <select value={tested} onChange={(event) => setTested(event.target.value as TestedFilter)}>
              <option value="all">All</option>
              <option value="tested">Tested</option>
              <option value="not_tested">Not tested</option>
            </select>
          </label>
          <label>
            <span>Rating</span>
            <select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))}>
              <option value={0}>All</option>
              <option value={1}>1+ stars</option>
              <option value={2}>2+ stars</option>
              <option value={3}>3+ stars</option>
              <option value={4}>4+ stars</option>
              <option value={5}>5 stars</option>
            </select>
          </label>
        </section>

        {hasFilters ? (
          <button className={styles.clearFilters} onClick={clearFilters} type="button">
            Clear all filters
          </button>
        ) : null}
      </header>

      <section className={styles.toolbar}>
        <p><strong>{filtered.length}</strong> {filtered.length === 1 ? "recipe" : "recipes"}{recipes.length !== filtered.length ? ` of ${recipes.length}` : ""}</p>
        <div className={styles.toolbarActions}>
          <label className={styles.sortControl}>
            <SlidersHorizontal aria-hidden="true" size={16} />
            <select aria-label="Sort recipes" onChange={(event) => setSort(event.target.value as SortOption)} value={sort}>
              <option value="recent">Recently added</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="rating">Highest rated</option>
            </select>
          </label>
          <div className={styles.viewToggle} aria-label="View options">
            <button aria-label="Grid view" aria-pressed={view === "grid"} className={view === "grid" ? styles.viewActive : undefined} onClick={() => setView("grid")} type="button"><Grid2X2 aria-hidden="true" size={18} /></button>
            <button aria-label="List view" aria-pressed={view === "list"} className={view === "list" ? styles.viewActive : undefined} onClick={() => setView("list")} type="button"><List aria-hidden="true" size={20} /></button>
          </div>
        </div>
      </section>

      {filtered.length ? (
        <section className={view === "grid" ? styles.grid : styles.list} aria-live="polite">
          {filtered.map((recipe) => {
            const hasImage = Boolean(recipe.media.heroImage);
            return (
              <Link className={`${styles.card} ${!hasImage ? styles.cardWithoutImage : ""}`} href={`/recipes/${recipe.id}`} key={recipe.id}>
                {hasImage ? <div className={styles.image} style={{ backgroundImage: `url("${recipe.media.heroImage}")` }} /> : null}
                <div className={styles.body}>
                  <div className={styles.cardTopline}>
                    <p>{recipe.classification.mainIngredients.join(" · ") || "Recipe"}</p>
                    <button aria-label={recipe.personal.favorite ? "Remove from favorites" : "Add to favorites"} className={styles.favoriteButton} onClick={(event) => toggleFavorite(event, recipe)} type="button">
                      <Heart aria-hidden="true" fill={recipe.personal.favorite ? "currentColor" : "none"} size={18} />
                    </button>
                  </div>
                  <h2>{recipe.title}</h2>
                  {sourceLine(recipe) ? <span className={styles.source}>{sourceLine(recipe)}</span> : null}
                  <div className={styles.recipeMeta}>
                    <span>{recipe.personal.tested ? "Tested" : "Not tested"}</span>
                    <Rating value={recipe.personal.rating} />
                  </div>
                  <div className={styles.nutrition}>
                    <strong>{recipe.nutrition.calories.min === null ? "Nutrition not provided" : `${formatRange(recipe.nutrition.calories)} kcal`}</strong>
                    <span>{displayMacro(recipe.nutrition.proteinG, " g P")}</span>
                    <span>{displayMacro(recipe.nutrition.carbohydratesG, " g C")}</span>
                    <span>{displayMacro(recipe.nutrition.fatG, " g F")}</span>
                    <span>{displayMacro(recipe.nutrition.fiberG, " g fiber")}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty}>
          <h2>{recipes.length ? "No recipes match these filters." : "No saved recipes yet."}</h2>
          <p>{recipes.length ? "Clear the filters and try again." : "Paste a recipe and save it to add it to your library."}</p>
          {hasFilters ? <button onClick={clearFilters} type="button">Clear filters</button> : <Link href="/paste">Add recipe</Link>}
        </section>
      )}
    </main>
  );
}
