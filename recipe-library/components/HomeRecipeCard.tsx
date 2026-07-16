import Link from "next/link";

type HomeRecipeCardProps = {
  title: string;
  author: string;
  publication: string;
  calories: string;
  protein: string;
  image: string;
  status?: string;
};

export function HomeRecipeCard({
  title,
  author,
  publication,
  calories,
  protein,
  image,
  status,
}: HomeRecipeCardProps) {
  return (
    <Link className="home-recipe-card" href="/browse">
      <div
        className="home-recipe-card__image"
        style={{ backgroundImage: `url("${image}")` }}
      >
        {status ? <span className="status-label">{status}</span> : null}
      </div>

      <div className="home-recipe-card__body">
        <h3>{title}</h3>
        <p>
          {author} <span aria-hidden="true">·</span> {publication}
        </p>
        <p className="home-recipe-card__nutrition">
          {calories} <span aria-hidden="true">·</span> {protein}
        </p>
      </div>
    </Link>
  );
}
