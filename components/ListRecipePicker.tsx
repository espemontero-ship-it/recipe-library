"use client";

import { Minus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ingredientDisplayLine } from "@/lib/ingredientParser";
import { getRecipeDefaultServings } from "@/lib/planning";
import type { Recipe } from "@/lib/recipeModel";
import { scaleIngredientLine } from "@/lib/shoppingList";
import styles from "./ListRecipePicker.module.css";

type Props = {
  recipes: Recipe[];
  onAdd: (items: { text: string; recipeTitles: string[] }[]) => Promise<void>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function formatServings(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ListRecipePicker({ recipes, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [unselected, setUnselected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const chosen = recipes.find((recipe) => recipe.id === recipeId) ?? null;

  const matches = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return recipes
      .filter((recipe) => {
        const haystack = normalize(recipe.title);
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 8);
  }, [query, recipes]);

  const lines = useMemo(() => {
    if (!chosen) return [];
    const original = getRecipeDefaultServings(chosen);
    const factor = original > 0 ? servings / original : 1;
    return chosen.ingredientSections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        text: scaleIngredientLine(ingredientDisplayLine(item) || item.originalLine, factor),
      })),
    );
  }, [chosen, servings]);

  function choose(recipe: Recipe) {
    setRecipeId(recipe.id);
    setServings(getRecipeDefaultServings(recipe));
    setUnselected(new Set());
    setQuery("");
  }

  function toggleLine(id: string) {
    setUnselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function add() {
    if (!chosen || busy) return;
    const picked = lines.filter((line) => !unselected.has(line.id) && line.text.trim());
    if (!picked.length) return;
    setBusy(true);
    try {
      await onAdd(picked.map((line) => ({ text: line.text, recipeTitles: [chosen.title] })));
      setRecipeId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Add ingredients from a recipe" className={styles.picker}>
      {!chosen ? (
        <>
          <label className={styles.search}>
            <Search aria-hidden="true" size={16} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Add ingredients from a recipe…"
              type="text"
              value={query}
            />
          </label>
          {matches.length > 0 && (
            <ul className={styles.results}>
              {matches.map((recipe) => (
                <li key={recipe.id}>
                  <button onClick={() => choose(recipe)} type="button">
                    {recipe.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className={styles.chosen}>
          <header>
            <strong>{chosen.title}</strong>
            <button onClick={() => setRecipeId(null)} type="button">
              Cancel
            </button>
          </header>
          <div className={styles.servings}>
            <span>For</span>
            <div className={styles.stepper}>
              <button
                aria-label="Reduce servings"
                disabled={servings <= 0.5}
                onClick={() => setServings((current) => Math.max(0.5, current - 0.5))}
                type="button"
              >
                <Minus aria-hidden="true" size={14} />
              </button>
              <span>{formatServings(servings)}</span>
              <button
                aria-label="Increase servings"
                onClick={() => setServings((current) => current + 0.5)}
                type="button"
              >
                <Plus aria-hidden="true" size={14} />
              </button>
            </div>
            <span>people</span>
          </div>
          <ul className={styles.lines}>
            {lines.map((line) => (
              <li key={line.id}>
                <label>
                  <input
                    checked={!unselected.has(line.id)}
                    onChange={() => toggleLine(line.id)}
                    type="checkbox"
                  />
                  <span>{line.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            className={styles.addButton}
            disabled={busy || lines.length === unselected.size}
            onClick={() => void add()}
            type="button"
          >
            Add {lines.length - unselected.size} to list
          </button>
        </div>
      )}
    </section>
  );
}
