"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { getWeekStart } from "@/lib/planning";
import {
  createShoppingList,
  deleteShoppingList,
  getShoppingLists,
  shoppingListName,
  subscribeToLists,
  type ShoppingListSummary,
} from "@/lib/shoppingLists";
import styles from "./lists.module.css";

function ListsContent() {
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const next = await getShoppingLists();
        if (active) setLists(next);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Could not load your lists.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const unsubscribe = subscribeToLists(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function newList() {
    try {
      const id = await createShoppingList(getWeekStart());
      router.push(`/lists/${id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the list.");
    }
  }

  async function removeList(list: ShoppingListSummary) {
    if (!window.confirm(`Delete "${shoppingListName(list)}"?`)) return;
    try {
      await deleteShoppingList(list.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete the list.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Shopping</p>
          <h1>Lists</h1>
        </div>
        <button className={styles.primaryButton} onClick={() => void newList()} type="button">
          <Plus aria-hidden="true" size={16} />
          New list
        </button>
      </header>

      {error ? (
        <section className={styles.empty}>
          <h2>Something went wrong.</h2>
          <p>{error}</p>
        </section>
      ) : loading ? (
        <section className={styles.empty}>
          <h2>Loading your lists…</h2>
        </section>
      ) : lists.length === 0 ? (
        <section className={styles.empty}>
          <ListChecks aria-hidden="true" size={34} />
          <h2>No lists yet.</h2>
          <p>
            Create a list, add ingredients from recipes and anything else you need to buy.
          </p>
        </section>
      ) : (
        <ul className={styles.lists}>
          {lists.map((list) => {
            const bought = list.items.filter((item) => item.checked).length;
            return (
              <li key={list.id}>
                <Link href={`/lists/${list.id}`}>
                  <strong>{shoppingListName(list)}</strong>
                  <span>
                    {list.items.length === 0
                      ? "Empty"
                      : `${list.items.length - bought} left · ${bought} bought`}
                  </span>
                </Link>
                <button
                  aria-label={`Delete ${shoppingListName(list)}`}
                  onClick={() => void removeList(list)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default function ListsPage() {
  return (
    <AuthGate>
      <ListsContent />
    </AuthGate>
  );
}
