"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { HomeRecipeCard } from "@/components/HomeRecipeCard";
import {
  mergePersonalState,
  subscribeToPersonalState,
} from "@/lib/personalRecipeState";
import { formatRange, Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipes } from "@/lib/supabaseRecipes";

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <Link href="/browse">
        See all <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

function EmptyPersonalSection({ label }: { label: string }) {
  return (
    <div className="home-personal-empty">
      <p>No recipes marked as {label.toLowerCase()} yet.</p>
      <Link href="/browse">Browse recipes</Link>
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
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [version, setVersion] = useState(0);

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
        setVersion((current) => current + 1);
      }),
    [],
  );

  const personalised = useMemo(
    () => recipes.map(mergePersonalState),
    [recipes, version],
  );

  const weekend = personalised
    .filter((recipe) => recipe.personal.thisWeekend)
    .slice(0, 3);
  const favorites = personalised
    .filter((recipe) => recipe.personal.favorite)
    .slice(0, 4);

  return (
    <>
      <section className="home-section">
        <SectionHeading title="This Weekend" />
        {weekend.length ? (
          <div className="recipe-grid recipe-grid--three">
            {weekend.map((recipe) => (
              <HomeRecipeCard
                key={recipe.id}
                {...cardProps(recipe, "This Weekend")}
              />
            ))}
          </div>
        ) : (
          <EmptyPersonalSection label="This Weekend" />
        )}
      </section>

      <section className="home-section">
        <SectionHeading title="Favorites" />
        {favorites.length ? (
          <div className="recipe-grid recipe-grid--four">
            {favorites.map((recipe) => (
              <HomeRecipeCard key={recipe.id} {...cardProps(recipe)} />
            ))}
          </div>
        ) : (
          <EmptyPersonalSection label="Favorites" />
        )}
      </section>
    </>
  );
}
