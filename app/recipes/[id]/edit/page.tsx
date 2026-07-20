"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { RecipeEditor } from "@/components/RecipeEditor";
import type { Recipe } from "@/lib/recipeModel";
import { getSupabaseRecipe, updateSupabaseRecipe } from "@/lib/supabaseRecipes";

function EditRecipePageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getSupabaseRecipe(params.id)
      .then((value) => {
        if (active) setRecipe(value);
      })
      .catch(() => {
        if (active) setRecipe(null);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (recipe === undefined) return <main style={{ padding: 32 }}>Loading editor…</main>;
  if (!recipe) return <main style={{ padding: 32 }}>Recipe not found.</main>;

  return (
    <RecipeEditor
      initialRecipe={recipe}
      onSave={async (nextRecipe) => {
        const saved = await updateSupabaseRecipe(nextRecipe);
        router.push(`/recipes/${saved.slug}`);
        router.refresh();
      }}
    />
  );
}

export default function EditRecipePage() {
  return (
    <AdminGate>
      <EditRecipePageContent />
    </AdminGate>
  );
}
