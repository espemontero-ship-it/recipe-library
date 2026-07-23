"use client";

import Link from "next/link";
import { ingredientDisplayLine } from "@/lib/ingredientParser";
import {
  CalendarDays,
  CalendarPlus,
  Grid2X2,
  Heart,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrowseRecipeCard } from "@/components/BrowseRecipeCard";
import { useAuth } from "@/lib/auth";
import { subscribeToPersonalState } from "@/lib/personalRecipeState";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import {
  addRecipesToPlanning,
  getPlanning,
  getWeekStart,
  removePlanningItem,
  subscribeToPlanning,
  type PlanningItem,
} from "@/lib/planning";
import { regenerateShoppingWeekIfExists } from "@/lib/shoppingList";
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

type PersonalFilter = "favorite" | "planning";
type RatingFilter = "all" | "5" | "4plus" | "3plus" | "unrated";
type CookedFilter = "all" | "cooked" | "never";
type SortValue =
  | "title-asc"
  | "title-desc"
  | "newest"
  | "rating-desc";
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
  { key: "planning", label: "Planning" },
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
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [personalVersion, setPersonalVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<Record<FacetKey, string[]>>(EMPTY_FILTERS);
  const [personalFilters, setPersonalFilters] = useState<PersonalFilter[]>([]);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [cookedFilter, setCookedFilter] = useState<CookedFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortValue>("title-asc");
  const [view, setView] = useState<ViewValue>("grid");
  const [planningMode, setPlanningMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [planningBusyRecipeIds, setPlanningBusyRecipeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) setQuery(initialQuery);
    if (params.get("plan") === "1") setPlanningMode(true);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshPlan = async () => {
      try {
        const items = await getPlanning();
        if (active) setPlanningItems(items);
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
    () => recipes,
    [recipes, personalVersion],
  );

  const plannedRecipeIds = useMemo(
    () => Array.from(new Set(planningItems.map((item) => item.recipeId))),
    [planningItems],
  );

  const thisWeekItemsByRecipe = useMemo(() => {
    const currentWeek = getWeekStart();
    return new Map(
      planningItems
        .filter((item) => item.weekStart === currentWeek)
        .map((item) => [item.recipeId, item]),
    );
  }, [planningItems]);

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
        personalFilters.length +
          (ratingFilter === "all" ? 0 : 1) +
          (cookedFilter === "all" ? 0 : 1),
      ),
    [cookedFilter, filters, personalFilters, ratingFilter],
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
            ...getRecipeIngredients(recipe).map((item) => ingredientDisplayLine(item) || item.originalLine),
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

      if (personalFilters.includes("favorite") && !recipe.personal.favorite) {
        return false;
      }

      if (cookedFilter === "cooked" && !recipe.personal.tested) {
        return false;
      }

      if (cookedFilter === "never" && recipe.personal.tested) {
        return false;
      }

      const rating = recipe.personal.rating;
      if (ratingFilter === "5" && rating !== 5) return false;
      if (ratingFilter === "4plus" && (rating ?? 0) < 4) return false;
      if (ratingFilter === "3plus" && (rating ?? 0) < 3) return false;
      if (ratingFilter === "unrated" && rating !== null) return false;

      if (
        personalFilters.includes("planning") &&
        !plannedRecipeIds.includes(recipe.id)
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

      if (sort === "rating-desc") {
        return (
          (b.personal.rating ?? -1) - (a.personal.rating ?? -1) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        );
      }

      return a.title.localeCompare(b.title, undefined, {
        sensitivity: "base",
      });
    });
  }, [
    cookedFilter,
    filters,
    personalFilters,
    personalisedRecipes,
    plannedRecipeIds,
    query,
    ratingFilter,
    sort,
  ]);

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
    setRatingFilter("all");
    setCookedFilter("all");
    setQuery("");
  }

  function updateRecipeInList(updated: Recipe) {
    setRecipes((current) =>
      current.map((recipe) => (recipe.id === updated.id ? updated : recipe)),
    );
    setPersonalVersion((version) => version + 1);
  }

  function togglePlanningMode() {
    setPlanningMode((current) => !current);
    setSelectedRecipeIds([]);
  }

  function toggleRecipeSelection(recipeId: string) {
    setSelectedRecipeIds((current) =>
      current.includes(recipeId)
        ? current.filter((id) => id !== recipeId)
        : [...current, recipeId],
    );
  }

  async function addSelectionToPlanning() {
    const selectedRecipes = personalisedRecipes.filter((recipe) =>
      selectedRecipeIds.includes(recipe.id),
    );
    try {
      await addRecipesToPlanning(selectedRecipes);
      await regenerateShoppingWeekIfExists(personalisedRecipes, getWeekStart());
      setSelectedRecipeIds([]);
      setPlanningMode(false);
      window.location.href = "/planning";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update Planning.");
    }
  }

  async function toggleThisWeek(recipe: Recipe) {
    if (planningBusyRecipeIds.includes(recipe.id)) return;
    setPlanningBusyRecipeIds((current) => [...current, recipe.id]);
    setError("");
    try {
      const currentItem = thisWeekItemsByRecipe.get(recipe.id);
      if (currentItem) {
        await removePlanningItem(currentItem.id);
      } else {
        await addRecipesToPlanning([recipe], getWeekStart());
      }
      await regenerateShoppingWeekIfExists(personalisedRecipes, getWeekStart());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not update this week.",
      );
    } finally {
      setPlanningBusyRecipeIds((current) =>
        current.filter((recipeId) => recipeId !== recipe.id),
      );
    }
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

          {user && (
            <button
              aria-pressed={planningMode}
              className={`${styles.planModeButton} ${
                planningMode ? styles.planModeButtonActive : ""
              }`}
              onClick={togglePlanningMode}
              type="button"
            >
              <CalendarPlus aria-hidden="true" size={17} />
              {planningMode ? "Cancel selection" : "Plan recipes"}
            </button>
          )}
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
                    filter.key === "favorite" ? Heart : CalendarDays;

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

            <div className={styles.historyFilters}>
              <label>
                <span>Cooked</span>
                <select
                  aria-label="Filter by cooking history"
                  onChange={(event) =>
                    setCookedFilter(event.target.value as CookedFilter)
                  }
                  value={cookedFilter}
                >
                  <option value="all">All recipes</option>
                  <option value="cooked">Made before</option>
                  <option value="never">Never made</option>
                </select>
              </label>

              <label>
                <span>Rating</span>
                <select
                  aria-label="Filter by rating"
                  onChange={(event) =>
                    setRatingFilter(event.target.value as RatingFilter)
                  }
                  value={ratingFilter}
                >
                  <option value="all">Any rating</option>
                  <option value="5">5 stars</option>
                  <option value="4plus">4 stars or more</option>
                  <option value="3plus">3 stars or more</option>
                  <option value="unrated">Not rated</option>
                </select>
              </label>
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
            {cookedFilter !== "all" && (
              <button onClick={() => setCookedFilter("all")} type="button">
                {cookedFilter === "cooked" ? "Made before" : "Never made"}
                <X aria-hidden="true" size={13} />
              </button>
            )}
            {ratingFilter !== "all" && (
              <button onClick={() => setRatingFilter("all")} type="button">
                {{
                  "5": "5 stars",
                  "4plus": "4+ stars",
                  "3plus": "3+ stars",
                  unrated: "Not rated",
                }[ratingFilter]}
                <X aria-hidden="true" size={13} />
              </button>
            )}
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
                <option value="rating-desc">Highest rated</option>
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
            const selected = selectedRecipeIds.includes(recipe.id);
            const alreadyPlanned = plannedRecipeIds.includes(recipe.id);
            const inThisWeek = thisWeekItemsByRecipe.has(recipe.id);

            return (
              <BrowseRecipeCard
                alreadyPlanned={planningMode ? inThisWeek : alreadyPlanned}
                inThisWeek={inThisWeek}
                key={recipe.id}
                onRecipeChange={updateRecipeInList}
                onToggleSelection={() => {
                  if (!inThisWeek) toggleRecipeSelection(recipe.id);
                }}
                onToggleThisWeek={() => toggleThisWeek(recipe)}
                planningBusy={planningBusyRecipeIds.includes(recipe.id)}
                planningMode={planningMode}
                recipe={recipe}
                selected={selected}
                view={view}
              />
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

      {planningMode && (
        <aside className={styles.selectionTray} aria-live="polite">
          <div>
            <CalendarDays aria-hidden="true" size={20} />
            <p>
              <strong>{selectedRecipeIds.length} selected</strong>
              <span>They will be added to this week first.</span>
            </p>
          </div>
          <button
            disabled={!selectedRecipeIds.length}
            onClick={() => void addSelectionToPlanning()}
            type="button"
          >
            Add to this week
          </button>
        </aside>
      )}
    </main>
  );
}
