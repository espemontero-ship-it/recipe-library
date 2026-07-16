import Link from "next/link";
import type { Recipe } from "@/lib/types";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const hasImage = (recipe as any).heroImage || (recipe as any).image;
  return (
    <Link href={`/recipes/${recipe.id}`} className={`recipe-card ${hasImage ? "has-image" : "no-image"}`}>
      {hasImage && (
        <div
          className="card-image"
          style={{ backgroundImage: `url(${(recipe as any).heroImage || (recipe as any).image})` }}
        />
      )}
      <div className="card-copy">
        <p className="eyebrow">{recipe.status}</p>
        <h3>{recipe.title}</h3>
        <p className="meta">{recipe.author} · {recipe.publication}</p>
        <p className="nutrition-line">{recipe.calories} kcal · {recipe.protein} g protein</p>
      </div>
    </Link>
  );
}
