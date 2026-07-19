"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Grid2X2,
  Heart,
  List,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  mergePersonalState,
  subscribeToPersonalState,
} from "@/lib/personalRecipeState";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import {
  formatRange,
  getRecipeIngredients,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./browse.module.css";

type FacetKey =
  | "ingredients"
  | "dish"
  | "format"
  | "mealType"
  | "method"
  | "cuisine";

type PersonalFilter = "favorite" | "tested" | "thisWeekend";
type SortValue = "title-asc" | "title-desc" | "newest";
type ViewValue = "grid" | "list";

const FACETS: {
  key: FacetKey;
  label: string;
  placeholder: string;
}[] = [
  { key: "ingredients", label: "Ingredients", placeholder: "Add ingredient" },
  { key: "dish", label: "Dish", placeholder: "Add dish" },
  { key: "format", label: "Format", placeholder: "Add format" },
  { key: "mealType", label: "Meal", placeholder: "Add meal type" },
  { key: "method", label: "Method", placeholder: "Add method" },
  { key: "cuisine", label: "Cuisine", placeholder: "Add cuisine" },
];

const PERSONAL_FILTERS: { key: PersonalFilter; label: string }[] = [
  { key: "favorite", label: "Favorites" },
  { key: "tested", label: "Tested" },
  { key: "thisWeekend", label: "This weekend" },
];

const EMPTY_FILTERS: Record<FacetKey, string[]> = {
  ingredients: [],
  dish: [],
  format: [],
  mealType: [],
  method: [],
  cuisine: [],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function valuesForFacet(recipe: Recipe, key: FacetKey) {
  switch (key) {
    case "ingredients":
      return recipe.classification.ingredientsIndex;
    case "dish":
      return recipe.classification.dish;
    case "format":
      return recipe.classification.formats;
    case "mealType":
      return recipe.classification.mealTypes;
    case "method":
      return recipe.classification.cookingMethods;
    case "cuisine":
      return recipe.classification.cuisines;
  }
}

export default function BrowsePage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [personalVersion, setPersonalVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<Record<FacetKey, string[]>>(EMPTY_FILTERS);
  const [personalFilters, setPersonalFilters] = useState<PersonalFilter[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortValue>("title-asc");
  const [view, setView] = useState<ViewValue>("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q");
    if (initialQuery) setQuery(initialQuery);
  }, []);

  useEffect(
    () =>
      subscribeToPersonalState(() => {
        getSupabaseRecipes()
          .then((items) => setRecipes(items))
          .catch(() => undefined);
        setPersonalVersion((version) => version + 1);
      }),
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

  const personalisedRecipes = useMemo(
    () => recipes.map(mergePersonalState),
    [recipes, personalVersion],
  );

  const facetOptions = useMemo(() => {
    return {
      ingredients: uniqueSorted(
        personalisedRecipes.flatMap(
          (recipe) => recipe.classification.ingredientsIndex,
        ),
      ),
      dish: uniqueSorted(
        personalisedRecipes.flatMap((recipe) => recipe.classification.dish),
      ),
      format: uniqueSorted(
        personalisedRecipes.flatMap(
          (recipe) => recipe.classification.formats,
        ),
      ),
      mealType: uniqueSorted(
        personalisedRecipes.flatMap(
          (recipe) => recipe.classification.mealTypes,
        ),
      ),
      method: uniqueSorted(
        personalisedRecipes.flatMap(
          (recipe) => recipe.classification.cookingMethods,
        ),
      ),
      cuisine: uniqueSorted(
        personalisedRecipes.flatMap(
          (recipe) => recipe.classification.cuisines,
        ),
      ),
    };
  }, [personalisedRecipes]);

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).reduce(
        (total, selectedValues) => total + selectedValues.length,
        personalFilters.length,
      ),
    [filters, personalFilters],
  );

  const filtered = useMemo(() => {
    const queryTerms = normalize(query).split(/\s+/).filter(Boolean);

    const matches = personalisedRecipes.filter((recipe) => {
      if (queryTerms.length) {
        const haystack = normalize(
          [
            recipe.title,
            recipe.source.author,
            recipe.source.type,
            recipe.summary,
            recipe.personal.privateNotes,
            ...recipe.classification.ingredientsIndex,
            ...recipe.classification.dish,
            ...recipe.classification.formats,
            ...recipe.classification.mealTypes,
            ...recipe.classification.cuisines,
            ...recipe.classification.cookingMethods,
            ...getRecipeIngredients(recipe).map((item) => item.originalLine),
          ]
            .filter(Boolean)
            .join(" "),
        );

        if (!queryTerms.every((term) => haystack.includes(term))) {
          return false;
        }
      }

      if (
        filters.ingredients.length &&
        !filters.ingredients.every((ingredient) =>
          recipe.classification.ingredientsIndex.includes(ingredient),
        )
      ) {
        return false;
      }

      for (const key of [
        "dish",
        "format",
        "mealType",
        "method",
        "cuisine",
      ] as FacetKey[]) {
        const selected = filters[key];
        if (
          selected.length &&
          !selected.some((value) => valuesForFacet(recipe, key).includes(value))
        ) {
          return false;
        }
      }

      if (
        personalFilters.length &&
        !personalFilters.every((key) => recipe.personal[key])
      ) {
        return false;
      }

      return true;
    });

    return [...matches].sort((a, b) => {
      if (sort === "title-desc") {
        return b.title.localeCompare(a.title, undefined, {
          sensitivity: "base",
        });
      }

      if (sort === "newest") {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }

      return a.title.localeCompare(b.title, undefined, {
        sensitivity: "base",
      });
    });
  }, [filters, personalFilters, personalisedRecipes, query, sort]);

  function addFilter(key: FacetKey, value: string) {
    if (!value) return;
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key]
        : [...current[key], value],
    }));
  }

  function removeFilter(key: FacetKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].filter((selected) => selected !== value),
    }));
  }

  function togglePersonalFilter(key: PersonalFilter) {
    setPersonalFilters((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setPersonalFilters([]);
    setQuery("");
  }

  const hasSearchOrFilters = Boolean(query.trim()) || activeFilterCount > 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTopline}>
          <div>
            <p className={styles.eyebrow}>Your library</p>
            <h1>Browse recipes</h1>
          </div>

        </div>

        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search aria-hidden="true" size={20} />
            <input
              aria-label="Search recipes"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, ingredient, author or private note..."
              type="search"
              value={query}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => setQuery("")}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>

          <button
            aria-expanded={filtersOpen}
            className={`${styles.filterButton} ${
              filtersOpen || activeFilterCount
                ? styles.filterButtonActive
                : ""
            }`}
            onClick={() => setFiltersOpen((open) => !open)}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" size={17} />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {filtersOpen && (
          <section aria-label="Recipe filters" className={styles.filterPanel}>
            <div className={styles.personalFilters}>
              <span>Personal</span>
              <div>
                {PERSONAL_FILTERS.map((filter) => {
                  const active = personalFilters.includes(filter.key);
                  const Icon =
                    filter.key === "favorite"
                      ? Heart
                      : filter.key === "tested"
                        ? CheckCircle2
                        : CalendarDays;

                  return (
                    <button
                      aria-pressed={active}
                      className={active ? styles.personalFilterActive : ""}
                      key={filter.key}
                      onClick={() => togglePersonalFilter(filter.key)}
                      type="button"
                    >
                      <Icon
                        aria-hidden="true"
                        fill={
                          active && filter.key === "favorite"
                            ? "currentColor"
                            : "none"
                        }
                        size={16}
                      />
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.facets}>
              {FACETS.map((facet) => (
                <label key={facet.key}>
                  <span>{facet.label}</span>
                  <select
                    aria-label={`Filter by ${facet.label.toLowerCase()}`}
                    onChange={(event) => {
                      addFilter(facet.key, event.target.value);
                      event.currentTarget.value = "";
                    }}
                    value=""
                  >
                    <option value="">{facet.placeholder}</option>
                    {facetOptions[facet.key]
                      .filter((value) => !filters[facet.key].includes(value))
                      .map((value) => (
                        <option key={value} value={value}>
                          {humanize(value)}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
          </section>
        )}

        {activeFilterCount > 0 && (
          <div className={styles.activeFilters}>
            <span>Active filters</span>
            {PERSONAL_FILTERS.filter((filter) =>
              personalFilters.includes(filter.key),
            ).map((filter) => (
              <button
                key={filter.key}
                onClick={() => togglePersonalFilter(filter.key)}
                type="button"
              >
                {filter.label}
                <X aria-hidden="true" size={13} />
              </button>
            ))}
            {FACETS.flatMap((facet) =>
              filters[facet.key].map((value) => (
                <button
                  key={`${facet.key}-${value}`}
                  onClick={() => removeFilter(facet.key, value)}
                  type="button"
                >
                  {humanize(value)}
                  <X aria-hidden="true" size={13} />
                </button>
              )),
            )}
            <button
              className={styles.clearAll}
              onClick={clearAll}
              type="button"
            >
              Clear all
            </button>
          </div>
        )}
      </header>

      {!loading && !error && (
        <section className={styles.toolbar}>
          <p aria-live="polite">
            <strong>{filtered.length}</strong> of {personalisedRecipes.length} recipes
          </p>

          <div className={styles.toolbarActions}>
            <label className={styles.sortControl}>
              <span>Sort</span>
              <select
                aria-label="Sort recipes"
                onChange={(event) =>
                  setSort(event.target.value as SortValue)
                }
                value={sort}
              >
                <option value="title-asc">Title A–Z</option>
                <option value="title-desc">Title Z–A</option>
                <option value="newest">Recently updated</option>
              </select>
            </label>

            <div aria-label="Recipe view" className={styles.viewToggle}>
              <button
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={view === "grid" ? styles.viewActive : ""}
                onClick={() => setView("grid")}
                type="button"
              >
                <Grid2X2 aria-hidden="true" size={17} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={view === "list"}
                className={view === "list" ? styles.viewActive : ""}
                onClick={() => setView("list")}
                type="button"
              >
                <List aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <section className={styles.empty}>
          <h2>Loading recipes…</h2>
        </section>
      ) : error ? (
        <section className={styles.empty}>
          <h2>Could not load recipes.</h2>
          <p>{error}</p>
        </section>
      ) : filtered.length ? (
        <section className={view === "grid" ? styles.grid : styles.list}>
          {filtered.map((recipe) => {
            const tags = [
              ...recipe.classification.dish,
              ...recipe.classification.formats,
              ...recipe.classification.mealTypes,
            ].slice(0, 3);

            return (
              <Link
                className={`${styles.card} ${
                  recipe.media.heroImage ? "" : styles.cardWithoutImage
                }`}
                href={`/recipes/${recipe.slug}`}
                key={recipe.id}
              >
                {recipe.media.heroImage && (
                  <div
                    className={styles.image}
                    style={{
                      backgroundImage: `url("${recipe.media.heroImage}")`,
                    }}
                  />
                )}
                <div className={styles.body}>
                  <div className={styles.cardTopline}>
                    <p>{tags.map(humanize).join(" · ") || "Recipe"}</p>
                    <span className={styles.personalIcons}>
                      {recipe.personal.favorite && (
                        <Heart aria-label="Favorite" fill="currentColor" size={17} />
                      )}
                      {recipe.personal.tested && (
                        <CheckCircle2 aria-label="Tested" size={17} />
                      )}
                      {recipe.personal.thisWeekend && (
                        <CalendarDays aria-label="This weekend" size={17} />
                      )}
                    </span>
                  </div>
                  <h2>{recipe.title}</h2>
                  {(recipe.source.author || recipe.source.type) && (
                    <span className={styles.source}>
                      {[recipe.source.author, recipe.source.type]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {recipe.personal.rating && (
                    <span
                      aria-label={`${recipe.personal.rating} out of 5 stars`}
                      className={styles.rating}
                    >
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          aria-hidden="true"
                          fill={
                            index < (recipe.personal.rating ?? 0)
                              ? "currentColor"
                              : "none"
                          }
                          key={index}
                          size={13}
                        />
                      ))}
                    </span>
                  )}
                  <div className={styles.nutrition}>
                    <strong>
                      {recipe.nutrition.calories.min === null
                        ? "Nutrition not calculated"
                        : `${formatRange(recipe.nutrition.calories)} kcal`}
                    </strong>
                    {recipe.yield.servingsDisplay && (
                      <span>{recipe.yield.servingsDisplay}</span>
                    )}
                    {recipe.yield.timeDisplay && (
                      <span>{recipe.yield.timeDisplay}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty}>
          <h2>
            {personalisedRecipes.length
              ? "No recipes match these filters."
              : "No saved recipes yet."}
          </h2>
          <p>
            {hasSearchOrFilters
              ? "Remove a filter or try a broader search."
              : "Add your first recipe to start the library."}
          </p>
          {hasSearchOrFilters ? (
            <button onClick={clearAll} type="button">
              Clear search and filters
            </button>
          ) : null}
        </section>
      )}
    </main>
  );
}
