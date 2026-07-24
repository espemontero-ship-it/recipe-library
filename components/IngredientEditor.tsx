"use client";

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  Copy,
  ListPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { NumericField } from "@/components/NumericField";
import { parseIngredientLine } from "@/lib/ingredientParser";
import type {
  RecipeIngredient,
  RecipeIngredientSection,
} from "@/lib/recipeModel";
import styles from "./IngredientEditor.module.css";

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

function resetLegacyNutrition(): RecipeIngredient["nutrition"] {
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
        <strong>{counts.total} ingredients</strong>
        <span>
          {counts.parsed} parsed · {counts.total - counts.parsed} need review
        </span>
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
                <Trash2 aria-hidden="true" size={15} />
              </button>
            )}
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colDrag} />
                <th className={styles.colQty}>Qty</th>
                <th className={styles.colUnit}>Unit</th>
                <th className={styles.colName}>Name</th>
                <th className={styles.colNote}>Note</th>
                <th className={styles.colStatus}>Status</th>
                <th className={styles.colActions} />
              </tr>
            </thead>
            <tbody>
              {section.items.map((item, itemIndex) => {
                const expanded = openIngredient === item.id;
                const parsed = item.parseStatus === "confirmed";

                return (
                  <Fragment key={item.id}>
                    <tr className={styles.row}>
                      <td className={styles.colDrag}>
                        <div className={styles.dragButtons}>
                          <button
                            aria-label="Move ingredient up"
                            disabled={itemIndex === 0}
                            onClick={() =>
                              commit(
                                sectionsRef.current.map((current, index) =>
                                  index === sectionIndex
                                    ? { ...current, items: move(current.items, itemIndex, itemIndex - 1) }
                                    : current,
                                ),
                              )
                            }
                            type="button"
                          >
                            <ArrowUp aria-hidden="true" size={12} />
                          </button>
                          <button
                            aria-label="Move ingredient down"
                            disabled={itemIndex === section.items.length - 1}
                            onClick={() =>
                              commit(
                                sectionsRef.current.map((current, index) =>
                                  index === sectionIndex
                                    ? { ...current, items: move(current.items, itemIndex, itemIndex + 1) }
                                    : current,
                                ),
                              )
                            }
                            type="button"
                          >
                            <ArrowDown aria-hidden="true" size={12} />
                          </button>
                        </div>
                      </td>

                      <td className={styles.colQty}>
                        <NumericField
                          aria-label="Ingredient quantity"
                          onCommit={(value) =>
                            setIngredient(sectionIndex, itemIndex, {
                              parseStatus: "confirmed",
                              quantity: { min: value, max: value },
                              nutrition: resetLegacyNutrition(),
                            })
                          }
                          value={item.quantity.min}
                          warningClassName={styles.warn}
                        />
                      </td>

                      <td className={styles.colUnit}>
                        <input
                          aria-label="Ingredient unit"
                          onChange={(event) =>
                            setIngredient(sectionIndex, itemIndex, {
                              parseStatus: "confirmed",
                              unit: event.target.value || null,
                              nutrition: resetLegacyNutrition(),
                            })
                          }
                          placeholder="Unit"
                          value={item.unit ?? ""}
                        />
                      </td>

                      <td className={styles.colName}>
                        <input
                          aria-label="Ingredient name"
                          onChange={(event) =>
                            setIngredient(sectionIndex, itemIndex, {
                              parseStatus: event.target.value.trim() ? "confirmed" : "review",
                              canonicalIngredient: event.target.value || null,
                              nutrition: resetLegacyNutrition(),
                            })
                          }
                          placeholder="Ingredient"
                          value={item.canonicalIngredient ?? ""}
                        />
                      </td>

                      <td className={styles.colNote}>
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
                      </td>

                      <td className={styles.colStatus}>
                        <button
                          className={`${styles.statusChip} ${parsed ? styles.parsed : styles.review}`}
                          onClick={() =>
                            setIngredient(sectionIndex, itemIndex, {
                              parseStatus: parsed ? "review" : "confirmed",
                            })
                          }
                          type="button"
                        >
                          {parsed ? (
                            <CircleCheck aria-hidden="true" size={13} />
                          ) : (
                            <CircleAlert aria-hidden="true" size={13} />
                          )}
                          {parsed ? "Parsed" : "Review"}
                        </button>
                      </td>

                      <td className={styles.colActions}>
                        <div className={styles.rowActions}>
                          <button
                            aria-expanded={expanded}
                            aria-label="Ingredient details"
                            className={`${styles.iconButton} ${expanded ? styles.detailsOpen : ""}`}
                            onClick={() => setOpenIngredient(expanded ? null : item.id)}
                            type="button"
                          >
                            <ListPlus aria-hidden="true" size={14} />
                          </button>
                          <button
                            aria-label="Duplicate ingredient"
                            className={styles.iconButton}
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
                                            nutrition: resetLegacyNutrition(),
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
                            <Copy aria-hidden="true" size={14} />
                          </button>
                          <button
                            aria-label="Delete ingredient"
                            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
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
                            <Trash2 aria-hidden="true" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className={styles.detailsRow}>
                        <td colSpan={7}>
                          <div className={styles.detailsPanel}>
                            <p className={styles.originalLine}>
                              Original: {item.originalLine || "No original line"}
                            </p>
                            <div className={styles.flags}>
                              {(
                                [
                                  ["optional", "Optional"],
                                  ["garnish", "Garnish"],
                                  ["servingAccompaniment", "Accompaniment"],
                                ] as const
                              ).map(([key, label]) => (
                                <label key={key}>
                                  <input
                                    checked={Boolean(item[key])}
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
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

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
            <Plus aria-hidden="true" size={15} />
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
        <Plus aria-hidden="true" size={15} />
        Add ingredient section
      </button>
    </div>
  );
}
