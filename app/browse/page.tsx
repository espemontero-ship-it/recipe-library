"use client";

import { ingredientDisplayLine } from "@/lib/ingredientParser";
import {
  CalendarPlus,
  Grid2X2,
  Heart,
  List,
  Search,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  getRecipeIngredients,
  Recipe,
} from "@/lib/recipeModel";
import styles from "./browse.module.css";

type FacetKey = "ingredients" | "method" | "type" | "cuisine";

type PersonalFilter = "favorite" | "planning";
type RatingFilter = "all" | "5" | "4plus";
type SortValue = "title-asc" | "title-desc" | "newest" | "rating-desc";
type ViewValue = "grid" | "list";

const GENERIC_FACETS: { key: "cuisine"; label: string }[] = [
  { key: "cuisine", label: "Cuisine" },
];

// Curated 24/07/2026: Esperanza picked these from the full 16-value Type
// list (Format+Meal merged). Everything else is dropped from the sidebar.
const TYPE_GROUPS: { label: string; values: string[] }[] = [
  { label: "Salad", values: ["salad"] },
  { label: "Pasta", values: ["pasta"] },
  { label: "Rice", values: ["rice"] },
  { label: "Bowl", values: ["bowl"] },
  { label: "Dessert", values: ["dessert"] },
  { label: "Sauce", values: ["sauce"] },
  { label: "Soup", values: ["soup"] },
  { label: "Breakfast", values: ["breakfast"] },
];

// Curated 24/07/2026: Esperanza picked these from the full 18-value list,
// merging near-duplicate appliance names. Everything else is dropped from
// the sidebar (still searchable via free text, just not filterable).
const METHOD_GROUPS: { label: string; values: string[] }[] = [
  { label: "Oven", values: ["oven"] },
  { label: "Air fryer", values: ["air_fryer"] },
  { label: "No cook", values: ["no_cook"] },
  { label: "Slow cooker", values: ["slow_cooker"] },
  { label: "Ninja Creami", values: ["ninja_creami", "creami"] },
];

// Curated 24/07/2026: Esperanza picked these from the full 158-value list,
// merging singular/ground variants and all bean types into one chip.
const INGREDIENT_GROUPS: { label: string; values: string[] }[] = [
  { label: "Chicken", values: ["chicken", "ground chicken"] },
  { label: "Rice", values: ["rice"] },
  { label: "Cottage cheese", values: ["cottage cheese"] },
  { label: "Chicken broth", values: ["chicken broth"] },
  { label: "Beef", values: ["beef", "ground beef"] },
  { label: "Mozzarella", values: ["mozzarella"] },
  { label: "Feta", values: ["feta"] },
  { label: "Corn", values: ["corn"] },
  { label: "Shrimp", values: ["shrimp"] },
  { label: "Sriracha", values: ["sriracha"] },
  { label: "Chickpeas", values: ["chickpeas"] },
  { label: "Salmon", values: ["salmon"] },
  { label: "Tuna", values: ["tuna"] },
  { label: "Harissa", values: ["harissa"] },
  { label: "Beans", values: ["black beans", "kidney beans", "white beans", "pinto beans"] },
  { label: "Pork", values: ["pork", "ground pork"] },
  { label: "Turkey", values: ["turkey", "ground turkey"] },
  { label: "White fish", values: ["white fish"] },
  { label: "Ground lamb", values: ["ground lamb"] },
  { label: "Boursin", values: ["boursin"] },
  { label: "Ham", values: ["ham"] },
  { label: "Tahini", values: ["tahini"] },
  { label: "Hoisin", values: ["hoisin"] },
  { label: "Tofu", values: ["tofu"] },
  { label: "Squid", values: ["squid"] },
  { label: "Bacon", values: ["bacon"] },
];

const PERSONAL_FILTERS: { key: PersonalFilter; label: string }[] = [
  { key: "favorite", label: "Favorites" },
  { key: "planning", label: "Planning" },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: "5", label: "5 stars" },
  { value: "4plus", label: "4+ stars" },
];

const MAX_SUGGESTIONS = 6;

const EMPTY_FILTERS: Record<FacetKey, string[]> = {
  ingredients: [],
  method: [],
  type: [],
  cuisine: [],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function typeValuesForRecipe(recipe: Recipe) {
  return [
    ...recipe.classification.formats,
    ...recipe.classification.mealTypes.filter((value) => value !== "main"),
  ];
}

function buildValueToLabel(groups: { label: string; values: string[] }[]) {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const value of group.values) {
      map.set(value, group.label);
    }
  }
  return map;
}

const METHOD_VALUE_TO_LABEL = buildValueToLabel(METHOD_GROUPS);
const INGREDIENT_VALUE_TO_LABEL = buildValueToLabel(INGREDIENT_GROUPS);
const TYPE_VALUE_TO_LABEL = buildValueToLabel(TYPE_GROUPS);

function curatedLabelsForRecipe(rawValues: string[], lookup: Map<string, string>) {
  const labels = new Set<string>();
  for (const raw of rawValues) {
    const label = lookup.get(raw);
    if (label) labels.add(label);
  }
  return labels;
}

function valuesForFacet(recipe: Recipe, key: FacetKey) {
  switch (key) {
    case "ingredients":
      return [...curatedLabelsForRecipe(recipe.classification.ingredientsIndex, INGREDIENT_VALUE_TO_LABEL)];
    case "method":
      return [...curatedLabelsForRecipe(recipe.classification.cookingMethods, METHOD_VALUE_TO_LABEL)];
    case "cuisine":
      return recipe.classification.cuisines;
    case "type":
      return [...curatedLabelsForRecipe(typeValuesForRecipe(recipe), TYPE_VALUE_TO_LABEL)];
  }
}

function sortByName(entries: [string, number][]) {
  return [...entries].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: "base" }),
  );
}

export default function BrowsePage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [personalVersion, setPersonalVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [filters, setFilters] = useState<Record<FacetKey, string[]>>(EMPTY_FILTERS);
  const [personalFilters, setPersonalFilters] = useState<PersonalFilter[]>([]);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<SortValue>("title-asc");
  const [view, setView] = useState<ViewValue>("list");
  const [planningMode, setPlanningMode] = useState(false);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [planningBusyRecipeIds, setPlanningBusyRecipeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipesError, setRecipesError] = useState("");
  const [planningError, setPlanningError] = useState("");
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery) setQuery(initialQuery);
    if (params.get("plan") === "1") setPlanningMode(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setPlanningItems([]);
      return;
    }

    let active = true;
    const refreshPlan = async () => {
      try {
        const items = await getPlanning();
        if (active) setPlanningItems(items);
      } catch (reason) {
        if (active) {
          setPlanningError(reason instanceof Error ? reason.message : "Could not load Planning.");
        }
      }
    };
    void refreshPlan();
    const unsubscribe = subscribeToPlanning(() => void refreshPlan());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

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
          setRecipesError(
            reason instanceof Error ? reason.message : "Could not load recipes.",
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

  const personalisedRecipes = useMemo(() => recipes, [recipes, personalVersion]);

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

  const facetCounts = useMemo(() => {
    const method = new Map<string, number>();
    const cuisine = new Map<string, number>();
    const type = new Map<string, number>();
    const ingredients = new Map<string, number>();

    for (const recipe of personalisedRecipes) {
      for (const label of curatedLabelsForRecipe(recipe.classification.cookingMethods, METHOD_VALUE_TO_LABEL)) {
        method.set(label, (method.get(label) ?? 0) + 1);
      }
      for (const value of new Set(recipe.classification.cuisines)) {
        cuisine.set(value, (cuisine.get(value) ?? 0) + 1);
      }
      for (const label of curatedLabelsForRecipe(typeValuesForRecipe(recipe), TYPE_VALUE_TO_LABEL)) {
        type.set(label, (type.get(label) ?? 0) + 1);
      }
      for (const label of curatedLabelsForRecipe(recipe.classification.ingredientsIndex, INGREDIENT_VALUE_TO_LABEL)) {
        ingredients.set(label, (ingredients.get(label) ?? 0) + 1);
      }
    }

    return { method, cuisine, type, ingredients };
  }, [personalisedRecipes]);

  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const term = normalize(trimmed);
    const seen = new Set<string>();
    const results: string[] = [];

    for (const recipe of personalisedRecipes) {
      if (results.length >= MAX_SUGGESTIONS) break;
      if (normalize(recipe.title).includes(term) && !seen.has(recipe.title)) {
        seen.add(recipe.title);
        results.push(recipe.title);
      }
    }

    return results;
  }, [personalisedRecipes, query]);

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).reduce(
        (total, selectedValues) => total + selectedValues.length,
        personalFilters.length + (ratingFilter === "all" ? 0 : 1),
      ),
    [filters, personalFilters, ratingFilter],
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
            ...getRecipeIngredients(recipe).map(
              (item) => ingredientDisplayLine(item) || item.originalLine,
            ),
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
        !filters.ingredients.every((label) =>
          valuesForFacet(recipe, "ingredients").includes(label),
        )
      ) {
        return false;
      }

      for (const key of ["method", "type", "cuisine"] as FacetKey[]) {
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

      if (
        personalFilters.includes("planning") &&
        !plannedRecipeIds.includes(recipe.id)
      ) {
        return false;
      }

      const rating = recipe.personal.rating;
      if (ratingFilter === "5" && rating !== 5) return false;
      if (ratingFilter === "4plus" && (rating ?? 0) < 4) return false;

      return true;
    });

    return [...matches].sort((a, b) => {
      if (sort === "title-desc") {
        return b.title.localeCompare(a.title, undefined, { sensitivity: "base" });
      }

      if (sort === "newest") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }

      if (sort === "rating-desc") {
        return (
          (b.personal.rating ?? -1) - (a.personal.rating ?? -1) ||
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
        );
      }

      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }, [filters, personalFilters, personalisedRecipes, plannedRecipeIds, query, ratingFilter, sort]);

  function toggleFacetValue(key: FacetKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((selected) => selected !== value)
        : [...current[key], value],
    }));
  }

  function togglePersonalFilter(key: PersonalFilter) {
    setPersonalFilters((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  }

  function toggleRatingFilter(value: RatingFilter) {
    setRatingFilter((current) => (current === value ? "all" : value));
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setPersonalFilters([]);
    setRatingFilter("all");
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
      setPlanningError(reason instanceof Error ? reason.message : "Could not update Planning.");
    }
  }

  async function toggleThisWeek(recipe: Recipe) {
    if (planningBusyRecipeIds.includes(recipe.id)) return;
    setPlanningBusyRecipeIds((current) => [...current, recipe.id]);
    setPlanningError("");
    try {
      const currentItem = thisWeekItemsByRecipe.get(recipe.id);
      if (currentItem) {
        await removePlanningItem(currentItem.id);
      } else {
        await addRecipesToPlanning([recipe], getWeekStart());
      }
      await regenerateShoppingWeekIfExists(personalisedRecipes, getWeekStart());
    } catch (reason) {
      setPlanningError(reason instanceof Error ? reason.message : "Could not update this week.");
    } finally {
      setPlanningBusyRecipeIds((current) =>
        current.filter((recipeId) => recipeId !== recipe.id),
      );
    }
  }

  function selectSuggestion(value: string) {
    setQuery(value);
    setSuggestionsOpen(false);
  }

  function handleSearchBlur() {
    blurTimeout.current = setTimeout(() => setSuggestionsOpen(false), 120);
  }

  function handleSearchFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    if (suggestions.length) setSuggestionsOpen(true);
  }

  const hasSearchOrFilters = Boolean(query.trim()) || activeFilterCount > 0;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1>Browse recipes</h1>

        {user && (
          <button
            aria-pressed={planningMode}
            className={`${styles.planModeButton} ${
              planningMode ? styles.planModeButtonActive : ""
            }`}
            onClick={togglePlanningMode}
            type="button"
          >
            <CalendarPlus aria-hidden="true" size={16} />
            {planningMode ? "Cancel selection" : "Plan recipes"}
          </button>
        )}
      </div>

      <div className={styles.searchRow}>
        <div className={styles.search}>
          <Search aria-hidden="true" size={19} />
          <input
            aria-label="Search recipes"
            onBlur={handleSearchBlur}
            onChange={(event) => {
              setQuery(event.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={handleSearchFocus}
            placeholder="Search title, ingredient, author..."
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery("")}
              type="button"
            >
              <X aria-hidden="true" size={17} />
            </button>
          )}

          {suggestionsOpen && suggestions.length > 0 && (
            <ul className={styles.suggestions} role="listbox">
              {suggestions.map((title) => (
                <li key={title}>
                  <button onClick={() => selectSuggestion(title)} type="button">
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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

      <div className={styles.layout}>
        <aside aria-label="Recipe filters" className={styles.sidebar}>
          <div className={styles.filterGroup}>
            <p className={styles.filterGroupLabel}>Personal</p>
            <div className={styles.chipRow}>
              {PERSONAL_FILTERS.map((filter) => {
                const active = personalFilters.includes(filter.key);
                return (
                  <button
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    key={filter.key}
                    onClick={() => togglePersonalFilter(filter.key)}
                    type="button"
                  >
                    {filter.key === "favorite" ? (
                      <Heart aria-hidden="true" fill={active ? "currentColor" : "none"} size={14} />
                    ) : (
                      <CalendarPlus aria-hidden="true" size={14} />
                    )}
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <p className={styles.filterGroupLabel}>Rating</p>
            <div className={styles.chipRow}>
              {RATING_OPTIONS.map((option) => {
                const active = ratingFilter === option.value;
                return (
                  <button
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    key={option.value}
                    onClick={() => toggleRatingFilter(option.value)}
                    type="button"
                  >
                    <Star aria-hidden="true" fill={active ? "currentColor" : "none"} size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <p className={styles.filterGroupLabel}>Method</p>
            <div className={styles.chipRow}>
              {METHOD_GROUPS.map(({ label }) => {
                const active = filters.method.includes(label);
                const count = facetCounts.method.get(label) ?? 0;
                return (
                  <button
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    key={label}
                    onClick={() => toggleFacetValue("method", label)}
                    type="button"
                  >
                    {label} · {count}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <p className={styles.filterGroupLabel}>Type</p>
            <div className={styles.chipRow}>
              {TYPE_GROUPS.map(({ label }) => {
                const active = filters.type.includes(label);
                const count = facetCounts.type.get(label) ?? 0;
                return (
                  <button
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    key={label}
                    onClick={() => toggleFacetValue("type", label)}
                    type="button"
                  >
                    {label} · {count}
                  </button>
                );
              })}
            </div>
          </div>

          {GENERIC_FACETS.map(({ key, label }) => (
            <div className={styles.filterGroup} key={key}>
              <p className={styles.filterGroupLabel}>{label}</p>
              <div className={styles.chipRow}>
                {sortByName([...facetCounts[key].entries()]).map(([value, count]) => {
                  const active = filters[key].includes(value);
                  return (
                    <button
                      aria-pressed={active}
                      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                      key={value}
                      onClick={() => toggleFacetValue(key, value)}
                      type="button"
                    >
                      {humanize(value)} · {count}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={styles.filterGroup}>
            <p className={styles.filterGroupLabel}>Ingredients</p>
            <div className={styles.chipRow}>
              {INGREDIENT_GROUPS.map(({ label }) => {
                const active = filters.ingredients.includes(label);
                const count = facetCounts.ingredients.get(label) ?? 0;
                return (
                  <button
                    aria-pressed={active}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    key={label}
                    onClick={() => toggleFacetValue("ingredients", label)}
                    type="button"
                  >
                    {label} · {count}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className={styles.content}>
          {!loading && !recipesError && (
            <section className={styles.toolbar}>
              <p aria-live="polite">
                <strong>{filtered.length}</strong> of {personalisedRecipes.length} recipes
                {activeFilterCount > 0 && (
                  <button className={styles.clearAll} onClick={clearAll} type="button">
                    Clear all
                  </button>
                )}
              </p>

              <label className={styles.sortControl}>
                <span>Sort</span>
                <select
                  aria-label="Sort recipes"
                  onChange={(event) => setSort(event.target.value as SortValue)}
                  value={sort}
                >
                  <option value="title-asc">Title A–Z</option>
                  <option value="title-desc">Title Z–A</option>
                  <option value="newest">Recently updated</option>
                  <option value="rating-desc">Highest rated</option>
                </select>
              </label>
            </section>
          )}

          {loading ? (
            <section className={styles.empty}>
              <h2>Loading recipes…</h2>
            </section>
          ) : recipesError ? (
            <section className={styles.empty}>
              <h2>Could not load recipes.</h2>
              <p>{recipesError}</p>
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
            <aside aria-live="polite" className={styles.selectionTray}>
              <div>
                <CalendarPlus aria-hidden="true" size={20} />
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
        </div>
      </div>
    </main>
  );
}
