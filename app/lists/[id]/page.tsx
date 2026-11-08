"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Clipboard, PencilLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { ListRecipePicker } from "@/components/ListRecipePicker";
import type { Recipe } from "@/lib/recipeModel";
import { getShoppingCategory, SHOPPING_CATEGORIES } from "@/lib/shoppingList";
import {
  addListItems,
  getShoppingList,
  removeListItem,
  setAllListItemsChecked,
  shoppingListName,
  subscribeToLists,
  updateListItem,
  type ShoppingListSummary,
} from "@/lib/shoppingLists";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";
import styles from "../lists.module.css";
import detail from "./detail.module.css";

function ListDetail() {
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const [list, setList] = useState<ShoppingListSummary | null | undefined>(undefined);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState("");
  const [manualItem, setManualItem] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await getShoppingList(listId);
        if (active) setList(next);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load the list.");
        }
      }
    };
    void refresh();
    const unsubscribe = subscribeToLists(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [listId]);

  useEffect(() => {
    let active = true;
    getSupabaseRecipes()
      .then((items) => {
        if (active) setRecipes(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => list?.items ?? [], [list]);
  const checkedCount = items.filter((item) => item.checked).length;
  const categorized = useMemo(
    () =>
      SHOPPING_CATEGORIES.map((category) => ({
        category,
        items: items.filter((item) => getShoppingCategory(item.text) === category),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  function report(reason: unknown, fallback: string) {
    setError(reason instanceof Error ? reason.message : fallback);
  }

  async function addManual() {
    if (!manualItem.trim()) return;
    try {
      await addListItems(listId, [{ text: manualItem }]);
      setManualItem("");
    } catch (reason) {
      report(reason, "Could not add the item.");
    }
  }

  async function copyList() {
    const text = items
      .filter((item) => !item.checked)
      .map((item) => `☐ ${item.text}`)
      .join("\n");
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (error) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <h2>Something went wrong.</h2>
          <p>{error}</p>
          <Link href="/lists">Back to lists</Link>
        </section>
      </main>
    );
  }

  if (list === undefined) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <h2>Loading list…</h2>
        </section>
      </main>
    );
  }

  if (list === null) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <h2>This list was not found.</h2>
          <Link href="/lists">Back to lists</Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={detail.backLink} href="/lists">
            <ArrowLeft aria-hidden="true" size={16} />
            Lists
          </Link>
          <h1>{shoppingListName(list)}</h1>
        </div>
      </header>

      <ListRecipePicker
        onAdd={async (newItems) => {
          try {
            await addListItems(listId, newItems);
          } catch (reason) {
            report(reason, "Could not add the ingredients.");
          }
        }}
        recipes={recipes}
      />

      {items.length > 0 && (
        <section className={detail.toolbar}>
          <div>
            <label className={detail.markAll} title="Mark all as bought">
              <input
                aria-label="Mark all as bought"
                checked={checkedCount === items.length}
                onChange={(event) =>
                  void setAllListItemsChecked(listId, event.target.checked).catch(
                    (reason: unknown) => report(reason, "Could not update the items."),
                  )
                }
                type="checkbox"
              />
              <span className={detail.checkmark}>
                {checkedCount === items.length && <Check aria-hidden="true" size={15} />}
              </span>
            </label>
            <strong>{items.length - checkedCount} left</strong>
            <span>{checkedCount} bought</span>
          </div>
          <button onClick={() => void copyList()} type="button">
            <Clipboard aria-hidden="true" size={15} />
            {copied ? "Copied" : "Copy list"}
          </button>
        </section>
      )}

      <div className={detail.groups}>
        {categorized.map((group) => (
          <section key={group.category}>
            <h2>{group.category}</h2>
            <div className={detail.items}>
              {group.items.map((item) => (
                <article
                  className={`${detail.item} ${item.checked ? detail.itemChecked : ""}`}
                  key={item.id}
                >
                  <label>
                    <input
                      checked={item.checked}
                      onChange={(event) =>
                        void updateListItem(item.id, { checked: event.target.checked }).catch(
                          (reason: unknown) => report(reason, "Could not update the item."),
                        )
                      }
                      type="checkbox"
                    />
                    <span className={detail.checkmark}>
                      {item.checked && <Check aria-hidden="true" size={15} />}
                    </span>
                  </label>
                  <div>
                    <input
                      aria-label={`Edit ${item.text}`}
                      defaultValue={item.text}
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value && value !== item.text) {
                          void updateListItem(item.id, { text: value }).catch(
                            (reason: unknown) => report(reason, "Could not update the item."),
                          );
                        }
                      }}
                      type="text"
                    />
                    <small>
                      {item.recipeTitles.length
                        ? item.recipeTitles.join(" · ")
                        : "Added manually"}
                    </small>
                  </div>
                  <button
                    aria-label={`Remove ${item.text}`}
                    onClick={() =>
                      void removeListItem(item.id).catch((reason: unknown) =>
                        report(reason, "Could not remove the item."),
                      )
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className={detail.addManual}>
        <PencilLine aria-hidden="true" size={18} />
        <input
          aria-label="Add an item manually"
          onChange={(event) => setManualItem(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void addManual();
          }}
          placeholder="Add anything else you need to buy…"
          type="text"
          value={manualItem}
        />
        <button disabled={!manualItem.trim()} onClick={() => void addManual()} type="button">
          <Plus aria-hidden="true" size={16} />
          Add
        </button>
      </section>
    </main>
  );
}

export default function ListDetailPage() {
  return (
    <AuthGate>
      <ListDetail />
    </AuthGate>
  );
}
