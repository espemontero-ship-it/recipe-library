"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HomeRecipeCard } from "@/components/HomeRecipeCard";
import { useAuth } from "@/lib/auth";
import {
  getPlanning,
  getWeekStart,
  subscribeToPlanning,
  type PlanningItem,
} from "@/lib/planning";
import { subscribeToPersonalState } from "@/lib/personalRecipeState";
import { Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";

function SectionHeading({ title, href = "/browse" }: { title: string; href?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <Link href={href}>See all</Link>
    </div>
  );
}

function isProperCased(value: string) {
  return value === value.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

function topByCount(values: string[], limit: number) {
  // Group case-insensitively so the same real value ("Adam Hoad" vs "adam hoad")
  // isn't split across multiple entries and pushed out of the top N.
  const groups = new Map<string, Map<string, number>>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const variants = groups.get(key) ?? new Map<string, number>();
    variants.set(value, (variants.get(value) ?? 0) + 1);
    groups.set(key, variants);
  }

  return [...groups.values()]
    .map((variants) => {
      const count = [...variants.values()].reduce((sum, n) => sum + n, 0);
      const entries = [...variants.entries()];
      const [name] = entries.find(([variant]) => isProperCased(variant)) ??
        entries.sort((a, b) => b[1] - a[1])[0];
      return { name, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function EmptyState({
  message,
  linkLabel,
  href,
}: {
  message: string;
  linkLabel: string;
  href: string;
}) {
  return (
    <div className="home-personal-empty">
      <p>{message}</p>
      <Link href={href}>{linkLabel}</Link>
    </div>
  );
}

function cardProps(recipe: Recipe) {
  return {
    title: recipe.title,
    href: `/recipes/${recipe.slug}`,
    image: recipe.media.heroImage,
  };
}

export function PersonalRecipeSections() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);

  useEffect(() => {
    let active = true;

    getSupabaseRecipes()
      .then((items) => {
        if (active) setRecipes(items);
      })
      .catch(() => {
        if (active) setRecipes([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () =>
      subscribeToPersonalState(() => {
        getSupabaseRecipes()
          .then((items) => setRecipes(items))
          .catch(() => undefined);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      setPlanningItems([]);
      return;
    }

    let active = true;
    const refreshPlan = () => {
      getPlanning()
        .then((items) => {
          if (active) setPlanningItems(items);
        })
        .catch(() => {
          if (active) setPlanningItems([]);
        });
    };

    refreshPlan();
    const unsubscribe = subscribeToPlanning(refreshPlan);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  const recentlyAdded = useMemo(
    () =>
      [...recipes]
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 4),
    [recipes],
  );

  const topIngredients = useMemo(
    () => topByCount(recipes.flatMap((recipe) => recipe.classification.ingredientsIndex), 5),
    [recipes],
  );

  const topAuthors = useMemo(
    () =>
      topByCount(
        recipes
          .map((recipe) => recipe.source.author)
          .filter((author): author is string => Boolean(author)),
        5,
      ),
    [recipes],
  );

  const thisWeekRecipes = useMemo(() => {
    const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    const currentWeek = getWeekStart();
    return planningItems
      .filter((item) => item.weekStart === currentWeek)
      .map((item) => recipesById.get(item.recipeId))
      .filter((recipe): recipe is Recipe => Boolean(recipe))
      .slice(0, 4);
  }, [planningItems, recipes]);

  return (
    <>
      <section className="home-section">
        <SectionHeading title="Recently Added" />
        {recentlyAdded.length ? (
          <div className="recipe-grid recipe-grid--four">
            {recentlyAdded.map((recipe) => (
              <HomeRecipeCard key={recipe.id} {...cardProps(recipe)} />
            ))}
          </div>
        ) : (
          <EmptyState href="/browse" linkLabel="Browse recipes" message="No recipes yet." />
        )}
      </section>

      {user && (
        <section className="home-section">
          <SectionHeading href="/planning" title="Your week" />
          {thisWeekRecipes.length ? (
            <div className="recipe-grid recipe-grid--four">
              {thisWeekRecipes.map((recipe) => (
                <HomeRecipeCard key={recipe.id} {...cardProps(recipe)} />
              ))}
            </div>
          ) : (
            <EmptyState
              href="/planning"
              linkLabel="Open Planning"
              message="No recipes planned for this week yet."
            />
          )}
        </section>
      )}

      {!user && (
        <section className="browse-band">
          <div>
            <p className="eyebrow">Plan your week</p>
            <h3>Sign up to save your own weekly plan and shopping list.</h3>
          </div>
          <Link className="button button--quiet" href="/signup">
            Sign up
          </Link>
        </section>
      )}

      <section className="browse-explore">
        <p className="eyebrow">Find your way in</p>
        <h3>Browse the library</h3>

        <div className="browse-explore__group">
          <p className="browse-explore__label">Main ingredient</p>
          <div className="browse-links">
            {topIngredients.map(({ name, count }) => (
              <Link href={`/browse?q=${encodeURIComponent(name)}`} key={name}>
                {name} · {count}
              </Link>
            ))}
          </div>
        </div>

        <div className="browse-explore__group">
          <p className="browse-explore__label">Author</p>
          <div className="browse-links">
            {topAuthors.map(({ name, count }) => (
              <Link href={`/browse?q=${encodeURIComponent(name)}`} key={name}>
                {name} · {count}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
