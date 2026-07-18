import Link from "next/link";
import { Search } from "lucide-react";
import { PersonalRecipeSections } from "@/components/PersonalRecipeSections";

const ingredients = ["Chicken", "Shrimp", "Salmon", "Beef", "Sweet Potato", "Pasta"];
const publications = ["NYT Cooking", "Instagram", "Foodiligence", "Adam Hoad"];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">Your personal cooking library</p>
          <h1>What will you cook next?</h1>
          <p className="home-hero__intro">
            Recipes worth keeping, beautifully organised and ready whenever
            you are.
          </p>

          <form className="hero-search" action="/browse">
            <Search aria-hidden="true" size={21} />
            <input
              aria-label="Search recipes"
              name="q"
              placeholder="Search recipes, ingredients, authors..."
              type="search"
            />
            <button type="submit">Search</button>
          </form>

          <div className="hero-actions">
            <Link className="button button--dark" href="/browse">
              Browse library
            </Link>
          </div>
        </div>

        <div
          aria-label="A table filled with colourful dishes"
          className="home-hero__image"
          role="img"
        />
      </section>

      <PersonalRecipeSections />

      <section className="browse-band">
        <div>
          <p className="eyebrow">Find your way in</p>
          <h2>Browse the library</h2>
        </div>

        <div className="browse-band__group">
          <h3>Main ingredient</h3>
          <div className="browse-links">
            {ingredients.map((ingredient) => (
              <Link href={`/browse?q=${encodeURIComponent(ingredient)}`} key={ingredient}>
                {ingredient}
              </Link>
            ))}
          </div>
        </div>

        <div className="browse-band__group">
          <h3>Publication</h3>
          <div className="browse-links">
            {publications.map((publication) => (
              <Link href={`/browse?q=${encodeURIComponent(publication)}`} key={publication}>
                {publication}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
