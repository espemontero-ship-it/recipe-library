import Link from "next/link";
import { PersonalRecipeSections } from "@/components/PersonalRecipeSections";

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

          <form className="hero-search-row" action="/browse">
            <input
              aria-label="Search recipes"
              className="hero-search"
              name="q"
              placeholder="Search recipes, ingredients, authors..."
              type="search"
            />
            <Link className="hero-filters" href="/browse">
              Filters
            </Link>
            <button className="hero-search-submit" type="submit">
              Search
            </button>
          </form>

          <div className="hero-actions">
            <Link className="button button--quiet" href="/browse">
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
    </main>
  );
}
