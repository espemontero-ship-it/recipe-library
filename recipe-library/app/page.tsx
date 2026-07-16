import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { HomeRecipeCard } from "@/components/HomeRecipeCard";

const thisWeekend = [
  {
    title: "Salmon with Lemon-Herb Marinade",
    author: "Moira Hodgson",
    publication: "The New York Times",
    calories: "552 kcal",
    protein: "47 g protein",
    image:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Black Pepper Beef & Cabbage",
    author: "Sue Li",
    publication: "NYT Cooking",
    calories: "465 kcal",
    protein: "41 g protein",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Chipotle Shrimp Pasta",
    author: "Recipe Library",
    publication: "Personal adaptation",
    calories: "487 kcal",
    protein: "38 g protein",
    image:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=85",
  },
];

const favorites = [
  {
    title: "Mediterranean Chicken Salad",
    author: "Shred Happens",
    publication: "Instagram",
    calories: "410 kcal",
    protein: "26 g protein",
    image:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Creamy Garlic Chicken Wraps",
    author: "Adam Hoad",
    publication: "Instagram",
    calories: "500 kcal",
    protein: "45 g protein",
    image:
      "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Puttanesca Poached Fish",
    author: "Sheela Prakash",
    publication: "NYT Cooking",
    calories: "345 kcal",
    protein: "37 g protein",
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1400&q=85",
  },
  {
    title: "Spicy Tuna Sushi Salad",
    author: "Mayden Fitness",
    publication: "Instagram",
    calories: "430 kcal",
    protein: "42 g protein",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=85",
  },
];

const ingredients = ["Chicken", "Shrimp", "Salmon", "Beef", "Sweet Potato", "Pasta"];
const publications = ["NYT Cooking", "Instagram", "Foodiligence", "Adam Hoad"];

const collections = [
  {
    name: "Best NYT Recipes",
    count: "18 recipes",
    image:
      "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "High Protein",
    count: "34 recipes",
    image:
      "https://images.unsplash.com/photo-1539136788836-5699e78bfc75?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Summer",
    count: "22 recipes",
    image:
      "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1400&q=85",
  },
];

function SectionHeading({
  title,
  href = "/browse",
}: {
  title: string;
  href?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <Link href={href}>
        See all <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

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
            <Link className="button button--dark" href="/paste">
              Paste recipe
            </Link>
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

      <section className="home-section">
        <SectionHeading title="This Weekend" />
        <div className="recipe-grid recipe-grid--three">
          {thisWeekend.map((recipe) => (
            <HomeRecipeCard key={recipe.title} {...recipe} status="This Weekend" />
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionHeading title="Favorites" />
        <div className="recipe-grid recipe-grid--four">
          {favorites.map((recipe) => (
            <HomeRecipeCard key={recipe.title} {...recipe} />
          ))}
        </div>
      </section>

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

      <section className="home-section">
        <SectionHeading href="/collections" title="Collections" />
        <div className="collection-grid">
          {collections.map((collection) => (
            <Link className="collection-card" href="/collections" key={collection.name}>
              <div
                className="collection-card__image"
                style={{ backgroundImage: `url("${collection.image}")` }}
              />
              <div className="collection-card__overlay">
                <span>{collection.count}</span>
                <h3>{collection.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
