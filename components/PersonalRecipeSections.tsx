"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { formatRange, Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";

function SectionHeading({ title, href = "/browse" }: { title: string; href?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <Link href={href}>
        See all <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
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

function cardProps(recipe: Recipe, status?: string) {
  return {
    title: recipe.title,
    href: `/recipes/${recipe.slug}`,
    author: recipe.source.author,
    publication: recipe.source.type,
    calories:
      recipe.nutrition.calories.min === null
        ? null
        : `${formatRange(recipe.nutrition.calories)} kcal`,
    protein:
      recipe.nutrition.proteinG.min === null
        ? null
        : `${formatRange(recipe.nutrition.proteinG, " g")} protein`,
    image: recipe.media.heroImage,
    status,
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
            <h2>Sign up to save your own weekly plan and shopping list.</h2>
            <Link className="button button--dark" href="/signup">
              Sign up
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
