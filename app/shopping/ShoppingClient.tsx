"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clipboard,
  PencilLine,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatPlanningWeekLabel,
  getPlanning,
  getWeekStart,
  subscribeToPlanning,
} from "@/lib/planning";
import type { Recipe } from "@/lib/recipeModel";
import {
  addManualShoppingItem,
  buildShoppingDraft,
  clearShoppingWeek,
  consolidateDraft,
  getShoppingCategory,
  getShoppingWeek,
  regenerateShoppingWeekIfExists,
  removeCheckedShoppingItems,
  removeShoppingItem,
  saveShoppingWeek,
  shoppingListText,
  subscribeToShopping,
  updateShoppingItem,
  SHOPPING_CATEGORIES,
  type ShoppingDraftItem,
  type ShoppingItem,
} from "@/lib/shoppingList";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import styles from "./shopping.module.css";

type Mode = "review" | "list";

type RecipeDraftGroup = {
  recipeId: string;
  recipeTitle: string;
  items: ShoppingDraftItem[];
};

function formatWeekRange(weekStart: string) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(year, month - 1, day, 12);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: start.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ShoppingClient({ weekStart: requestedWeek }: { weekStart: string }) {
  const weekStart = getWeekStart(requestedWeek);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [draft, setDraft] = useState<ShoppingDraftItem[]>([]);
  const [savedItems, setSavedItems] = useState<ShoppingItem[]>([]);
  const [mode, setMode] = useState<Mode>("review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualItem, setManualItem] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getSupabaseRecipes(), getPlanning(), getShoppingWeek(weekStart)])
      .then(([loadedRecipes, plan, saved]) => {
        if (!active) return;
        setRecipes(loadedRecipes);
        setDraft(buildShoppingDraft(loadedRecipes, plan, weekStart));
        setSavedItems(saved?.items ?? []);
        setMode(saved ? "list" : "review");
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Could not load the shopping list.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [weekStart]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const saved = await getShoppingWeek(weekStart);
        if (active) setSavedItems(saved?.items ?? []);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not refresh the shopping list.");
        }
      }
    };
    const unsubscribe = subscribeToShopping(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [weekStart]);

  useEffect(() => {
    let active = true;
    const refreshFromPlanning = async () => {
      try {
        const loadedRecipes = await getSupabaseRecipes();
        const regenerated = await regenerateShoppingWeekIfExists(
          loadedRecipes,
          weekStart,
        );
        if (!active) return;
        setRecipes(loadedRecipes);
        if (regenerated) {
          setSavedItems(regenerated.items);
          setMode("list");
        }
        const plan = await getPlanning();
        if (active) setDraft(buildShoppingDraft(loadedRecipes, plan, weekStart));
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not regenerate the shopping list.",
          );
        }
      }
    };
    const unsubscribe = subscribeToPlanning(() => void refreshFromPlanning());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [weekStart]);

  const recipeGroups = useMemo<RecipeDraftGroup[]>(() => {
    const groups = new Map<string, RecipeDraftGroup>();
    for (const item of draft) {
      const current = groups.get(item.planItemId);
      if (current) {
        current.items.push(item);
      } else {
        groups.set(item.planItemId, {
          recipeId: item.recipeId,
          recipeTitle: item.recipeTitle,
          items: [item],
        });
      }
    }
    return Array.from(groups.values());
  }, [draft]);

  const selectedCount = draft.filter((item) => item.selected).length;
  const checkedCount = savedItems.filter((item) => item.checked).length;
  const categorizedItems = useMemo(
    () =>
      SHOPPING_CATEGORIES.map((category) => ({
        category,
        items: savedItems.filter(
          (item) => getShoppingCategory(item.text) === category,
        ),
      })).filter((group) => group.items.length > 0),
    [savedItems],
  );
  const recipeImageById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe.media.heroImage])),
    [recipes],
  );

  function toggleDraftItem(id: string) {
    setDraft((current) =>
      current.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function setRecipeSelection(planItemId: string, selected: boolean) {
    setDraft((current) =>
      current.map((item) =>
        item.planItemId === planItemId ? { ...item, selected } : item,
      ),
    );
  }

  async function createList() {
    try {
      const recipeItems = consolidateDraft(weekStart, draft);
      const manualItems = savedItems.filter((item) => item.manual);
      const saved = await saveShoppingWeek(weekStart, [...recipeItems, ...manualItems]);
      setSavedItems(saved?.items ?? []);
      setMode("list");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the shopping list.");
    }
  }

  async function startReview() {
    try {
      const plan = await getPlanning();
      setDraft(buildShoppingDraft(recipes, plan, weekStart));
      setMode("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Planning.");
    }
  }

  async function addManualItem() {
    if (!manualItem.trim()) return;
    try {
      await addManualShoppingItem(weekStart, manualItem);
      setManualItem("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add the item.");
    }
  }

  async function copyList() {
    const text = shoppingListText(savedItems);
    if (!text) return;
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function clearList() {
    if (!window.confirm("Clear this shopping list?")) return;
    try {
      await clearShoppingWeek(weekStart);
      setSavedItems([]);
      setMode("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not clear the shopping list.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/planning">
            <ArrowLeft aria-hidden="true" size={16} />
            Planning
          </Link>
          <p className={styles.eyebrow}>{formatWeekRange(weekStart)}</p>
          <h1>Shopping list</h1>
          <p className={styles.intro}>{formatPlanningWeekLabel(weekStart)}</p>
        </div>
        {mode === "list" && savedItems.length > 0 && (
          <button className={styles.secondaryButton} onClick={() => void startReview()} type="button">
            <RotateCcw aria-hidden="true" size={16} />
            Review ingredients
          </button>
        )}
      </header>

      {loading ? (
        <section className={styles.empty}>
          <h2>Loading ingredients…</h2>
        </section>
      ) : error ? (
        <section className={styles.empty}>
          <h2>Could not prepare the shopping list.</h2>
          <p>{error}</p>
        </section>
      ) : mode === "review" ? (
        draft.length ? (
          <>
            <section className={styles.reviewIntro}>
              <div>
                <ShoppingBasket aria-hidden="true" size={22} />
                <p>
                  <strong>{selectedCount} ingredients selected</strong>
                  <span>Untick anything you already have at home.</span>
                </p>
              </div>
              <button disabled={selectedCount === 0} onClick={() => void createList()} type="button">
                Create shopping list
              </button>
            </section>

            <div className={styles.recipeGroups}>
              {recipeGroups.map((group) => {
                const allSelected = group.items.every((item) => item.selected);
                const selectedInRecipe = group.items.filter((item) => item.selected).length;
                const image = recipeImageById.get(group.recipeId);
                return (
                  <section className={styles.recipeGroup} key={group.items[0].planItemId}>
                    <header className={styles.recipeHeader}>
                      <div
                        aria-hidden="true"
                        className={styles.recipeImage}
                        style={image ? { backgroundImage: `url("${image}")` } : undefined}
                      />
                      <div>
                        <h2>{group.recipeTitle}</h2>
                        <p>
                          {selectedInRecipe} of {group.items.length} ingredients selected
                        </p>
                      </div>
                      <button
                        onClick={() => setRecipeSelection(group.items[0].planItemId, !allSelected)}
                        type="button"
                      >
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>
                    </header>

                    <div className={styles.ingredientList}>
                      {group.items.map((item) => (
                        <label className={styles.ingredientRow} key={item.id}>
                          <input
                            checked={item.selected}
                            onChange={() => toggleDraftItem(item.id)}
                            type="checkbox"
                          />
                          <span className={styles.checkmark}>
                            {item.selected && <Check aria-hidden="true" size={15} />}
                          </span>
                          <span>
                            {item.sectionTitle && (
                              <small>{item.sectionTitle}</small>
                            )}
                            <strong>{item.scaledLine}</strong>
                            {item.scaledLine !== item.originalLine && (
                              <small>Recipe: {item.originalLine}</small>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <footer className={styles.stickyAction}>
              <span>{selectedCount} ingredients selected</span>
              <button disabled={selectedCount === 0} onClick={() => void createList()} type="button">
                Create shopping list
              </button>
            </footer>
          </>
        ) : (
          <section className={styles.empty}>
            <ShoppingBasket aria-hidden="true" size={34} />
            <h2>No recipes marked for shopping.</h2>
            <p>
              Go back to Planning and tick “Include in shopping list” for at least one recipe in this week.
            </p>
            <Link href="/planning">Open Planning</Link>
          </section>
        )
      ) : savedItems.length ? (
        <>
          <section className={styles.listToolbar}>
            <div>
              <strong>{savedItems.length - checkedCount} left</strong>
              <span>{checkedCount} bought</span>
            </div>
            <div>
              <button disabled={checkedCount === 0} onClick={() =>
                void removeCheckedShoppingItems(weekStart).catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : "Could not remove bought items."),
                )
              } type="button">
                Remove bought
              </button>
              <button onClick={() => void copyList()} type="button">
                <Clipboard aria-hidden="true" size={15} />
                {copied ? "Copied" : "Copy list"}
              </button>
              <button className={styles.dangerButton} onClick={() => void clearList()} type="button">
                <Trash2 aria-hidden="true" size={15} />
                Clear
              </button>
            </div>
          </section>

          <div className={styles.categoryGroups}>
            {categorizedItems.map((group) => (
              <section className={styles.categoryGroup} key={group.category}>
                <h2>{group.category}</h2>
                <div className={styles.finalList}>
                  {group.items.map((item) => {
                    const sourceNames = Array.from(
                      new Set(item.sources.map((source) => source.recipeTitle)),
                    );
                    return (
                      <article
                        className={`${styles.finalItem} ${
                          item.checked ? styles.finalItemChecked : ""
                        }`}
                        key={item.id}
                      >
                        <label>
                          <input
                            checked={item.checked}
                            onChange={(event) =>
                              void updateShoppingItem(weekStart, item.id, {
                                checked: event.target.checked,
                              }).catch((reason: unknown) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "Could not update the item.",
                                ),
                              )
                            }
                            type="checkbox"
                          />
                          <span className={styles.checkmark}>
                            {item.checked && (
                              <Check aria-hidden="true" size={15} />
                            )}
                          </span>
                        </label>
                        <div>
                          <input
                            aria-label={`Edit ${item.text}`}
                            defaultValue={item.text}
                            onBlur={(event) =>
                              void updateShoppingItem(weekStart, item.id, {
                                text: event.target.value.trim() || item.text,
                              }).catch((reason: unknown) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "Could not update the item.",
                                ),
                              )
                            }
                            type="text"
                          />
                          <small>
                            {item.manual
                              ? "Added manually"
                              : sourceNames.length
                                ? sourceNames.join(" · ")
                                : "From planning"}
                          </small>
                        </div>
                        <button
                          aria-label={`Remove ${item.text}`}
                          onClick={() =>
                            void removeShoppingItem(weekStart, item.id).catch(
                              (reason: unknown) =>
                                setError(
                                  reason instanceof Error
                                    ? reason.message
                                    : "Could not remove the item.",
                                ),
                            )
                          }
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <section className={styles.addManual}>
            <PencilLine aria-hidden="true" size={18} />
            <input
              aria-label="Add an item manually"
              onChange={(event) => setManualItem(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addManualItem();
              }}
              placeholder="Add another item…"
              type="text"
              value={manualItem}
            />
            <button disabled={!manualItem.trim()} onClick={() => void addManualItem()} type="button">
              <Plus aria-hidden="true" size={16} />
              Add
            </button>
          </section>
        </>
      ) : (
        <section className={styles.empty}>
          <ShoppingBasket aria-hidden="true" size={34} />
          <h2>Your shopping list is empty.</h2>
          <button onClick={() => void startReview()} type="button">Review ingredients</button>
        </section>
      )}
    </main>
  );
}
