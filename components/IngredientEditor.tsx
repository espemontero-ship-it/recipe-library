"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { parseIngredientLine } from "@/lib/ingredientParser";
import type {
  RecipeIngredient,
  RecipeIngredientSection,
} from "@/lib/recipeModel";
import styles from "./IngredientEditor.module.css";

function numberValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function updateItem(
  sections: RecipeIngredientSection[],
  sectionIndex: number,
  itemIndex: number,
  patch: Partial<RecipeIngredient>,
) {
  return sections.map((section, currentSectionIndex) =>
    currentSectionIndex !== sectionIndex
      ? section
      : {
          ...section,
          items: section.items.map((item, currentItemIndex) =>
            currentItemIndex === itemIndex ? { ...item, ...patch } : item,
          ),
        },
  );
}

function move<T>(values: T[], from: number, to: number) {
  if (to < 0 || to >= values.length) return values;
  const next = [...values];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function resetLegacyNutrition(item: RecipeIngredient): RecipeIngredient["nutrition"] {
  return {
    status: "pending",
    fdcId: null,
    foodName: null,
    brandName: null,
    grams: null,
    per100g: null,
    note: null,
  };
}

export function IngredientEditor({
  sections,
  onChange,
  compact = false,
}: {
  sections: RecipeIngredientSection[];
  onChange: (sections: RecipeIngredientSection[]) => void;
  compact?: boolean;
}) {
  const [openIngredient, setOpenIngredient] = useState<string | null>(null);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const counts = useMemo(() => {
    const items = sections.flatMap((section) => section.items);
    return {
      total: items.length,
      parsed: items.filter((item) => item.parseStatus === "confirmed").length,
    };
  }, [sections]);

  function commit(next: RecipeIngredientSection[]) {
    sectionsRef.current = next;
    onChange(next);
  }

  function setIngredient(
    sectionIndex: number,
    itemIndex: number,
    patch: Partial<RecipeIngredient>,
  ) {
    commit(updateItem(sectionsRef.current, sectionIndex, itemIndex, patch));
  }

  return (
    <div className={`${styles.editor} ${compact ? styles.compact : ""}`}>
      <div className={styles.summary}>
        <div>
          <strong>{counts.total} ingredients</strong>
          <span>
            {counts.parsed} parsed · {counts.total - counts.parsed} need review
          </span>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        <section className={styles.section} key={section.id}>
          <div className={styles.sectionHeader}>
            <input
              aria-label={`Ingredient section ${sectionIndex + 1} title`}
              onChange={(event) =>
                commit(
                  sectionsRef.current.map((current, index) =>
                    index === sectionIndex
                      ? { ...current, title: event.target.value || null }
                      : current,
                  ),
                )
              }
              placeholder="Section title (optional)"
              value={section.title ?? ""}
            />
            {sections.length > 1 && (
              <button
                aria-label="Delete ingredient section"
                onClick={() =>
                  commit(sectionsRef.current.filter((_, index) => index !== sectionIndex))
                }
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            )}
          </div>

          <div className={styles.rows}>
            {section.items.map((item, itemIndex) => {
              const expanded = openIngredient === item.id;
              const parsed = item.parseStatus === "confirmed";

              return (
                <article className={styles.row} key={item.id}>
                  <div className={styles.rowMain}>
                    <div className={styles.dragButtons}>
                      <button
                        aria-label="Move ingredient up"
                        disabled={itemIndex === 0}
                        onClick={() =>
                          commit(
                            sectionsRef.current.map((current, index) =>
                              index === sectionIndex
                                ? {
                                    ...current,
                                    items: move(current.items, itemIndex, itemIndex - 1),
                                  }
                                : current,
                            ),
                          )
                        }
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" size={14} />
                      </button>
                      <button
                        aria-label="Move ingredient down"
                        disabled={itemIndex === section.items.length - 1}
                        onClick={() =>
                          commit(
                            sectionsRef.current.map((current, index) =>
                              index === sectionIndex
                                ? {
                                    ...current,
                                    items: move(current.items, itemIndex, itemIndex + 1),
                                  }
                                : current,
                            ),
                          )
                        }
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" size={14} />
                      </button>
                    </div>

                    <input
                      aria-label="Ingredient quantity"
                      className={styles.quantity}
                      inputMode="decimal"
                      onChange={(event) => {
                        const value = numberValue(event.target.value);
                        setIngredient(sectionIndex, itemIndex, {
                          parseStatus: "confirmed",
                          quantity: { min: value, max: value },
                          nutrition: resetLegacyNutrition(item),
                        });
                      }}
                      value={item.quantity.min ?? ""}
                    />

                    <input
                      aria-label="Ingredient unit"
                      className={styles.unit}
                      onChange={(event) =>
                        setIngredient(sectionIndex, itemIndex, {
                          parseStatus: "confirmed",
                          unit: event.target.value || null,
                          nutrition: resetLegacyNutrition(item),
                        })
                      }
                      placeholder="Unit"
                      value={item.unit ?? ""}
                    />

                    <input
                      aria-label="Ingredient name"
                      onChange={(event) =>
                        setIngredient(sectionIndex, itemIndex, {
                          parseStatus: event.target.value.trim() ? "confirmed" : "review",
                          canonicalIngredient: event.target.value || null,
                          nutrition: resetLegacyNutrition(item),
                        })
                      }
                      placeholder="Ingredient"
                      value={item.canonicalIngredient ?? ""}
                    />

                    <input
                      aria-label="Ingredient preparation note"
                      onChange={(event) =>
                        setIngredient(sectionIndex, itemIndex, {
                          preparationNote: event.target.value || null,
                        })
                      }
                      placeholder="Preparation / note"
                      value={item.preparationNote ?? ""}
                    />

                    <button
                      className={`${styles.parseButton} ${parsed ? styles.resolved : styles.pending}`}
                      onClick={() =>
                        setIngredient(sectionIndex, itemIndex, {
                          parseStatus: parsed ? "review" : "confirmed",
                        })
                      }
                      type="button"
                    >
                      {parsed ? (
                        <CircleCheck aria-hidden="true" size={15} />
                      ) : (
                        <CircleAlert aria-hidden="true" size={15} />
                      )}
                      {parsed ? "Parsed" : "Review"}
                    </button>

                    <button
                      className={styles.statusButton}
                      onClick={() => setOpenIngredient(expanded ? null : item.id)}
                      type="button"
                    >
                      {expanded ? "Close" : "Details"}
                    </button>

                    <button
                      aria-label="Duplicate ingredient"
                      className={styles.deleteButton}
                      onClick={() =>
                        commit(
                          sectionsRef.current.map((current, index) =>
                            index === sectionIndex
                              ? {
                                  ...current,
                                  items: [
                                    ...current.items.slice(0, itemIndex + 1),
                                    {
                                      ...item,
                                      id: `ingredient_${crypto.randomUUID()}`,
                                      nutrition: resetLegacyNutrition(item),
                                    },
                                    ...current.items.slice(itemIndex + 1),
                                  ],
                                }
                              : current,
                          ),
                        )
                      }
                      type="button"
                    >
                      <Copy aria-hidden="true" size={15} />
                    </button>

                    <button
                      aria-label="Delete ingredient"
                      className={styles.deleteButton}
                      onClick={() =>
                        commit(
                          sectionsRef.current.map((current, index) =>
                            index === sectionIndex
                              ? {
                                  ...current,
                                  items: current.items.filter((_, index) => index !== itemIndex),
                                }
                              : current,
                          ),
                        )
                      }
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  </div>

                  {expanded && (
                    <div className={styles.details}>
                      <p className={styles.originalLine}>
                        <strong>Original:</strong> {item.originalLine || "No original line"}
                      </p>

                      <div className={styles.parseDecision}>
                        <div>
                          <strong>Ingredient parsing</strong>
                          <span>
                            Confirm only whether quantity, unit, ingredient and note are separated correctly.
                          </span>
                        </div>
                        <button
                          className={parsed ? styles.choiceActive : ""}
                          onClick={() =>
                            setIngredient(sectionIndex, itemIndex, { parseStatus: "confirmed" })
                          }
                          type="button"
                        >
                          <CircleCheck aria-hidden="true" size={15} />
                          Parsing is correct
                        </button>
                        <button
                          className={!parsed ? styles.choiceActive : ""}
                          onClick={() =>
                            setIngredient(sectionIndex, itemIndex, { parseStatus: "review" })
                          }
                          type="button"
                        >
                          Needs correction
                        </button>
                      </div>

                      <div className={styles.flags}>
                        {[
                          ["optional", "Optional"],
                          ["garnish", "Garnish"],
                          ["servingAccompaniment", "Accompaniment"],
                        ].map(([key, label]) => (
                          <label key={key}>
                            <input
                              checked={Boolean(item[key as keyof RecipeIngredient])}
                              onChange={(event) =>
                                setIngredient(sectionIndex, itemIndex, {
                                  [key]: event.target.checked,
                                } as Partial<RecipeIngredient>)
                              }
                              type="checkbox"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <button
            className={styles.addIngredient}
            onClick={() =>
              commit(
                sectionsRef.current.map((current, index) =>
                  index === sectionIndex
                    ? { ...current, items: [...current.items, parseIngredientLine("")] }
                    : current,
                ),
              )
            }
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Add ingredient
          </button>
        </section>
      ))}

      <button
        className={styles.addSection}
        onClick={() =>
          commit([
            ...sectionsRef.current,
            {
              id: `ingredient_section_${crypto.randomUUID()}`,
              title: null,
              items: [],
            },
          ])
        }
        type="button"
      >
        <Plus aria-hidden="true" size={16} />
        Add ingredient section
      </button>
    </div>
  );
}
