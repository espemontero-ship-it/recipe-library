import Link from "next/link";

type HomeRecipeCardProps = {
  title: string;
  author: string | null;
  publication: string | null;
  calories: string | null;
  protein: string | null;
  image: string | null;
  status?: string;
  href: string;
};

export function HomeRecipeCard({
  title,
  author,
  publication,
  calories,
  protein,
  image,
  status,
  href,
}: HomeRecipeCardProps) {
  const source = [author, publication].filter(Boolean).join(" · ");
  const nutrition = [calories, protein].filter(Boolean).join(" · ");

  return (
    <Link className="home-recipe-card" href={href}>
      <div
        className={`home-recipe-card__image ${
          image ? "" : "home-recipe-card__image--empty"
        }`}
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
      >
        {status ? <span className="status-label">{status}</span> : null}
        {!image ? <span aria-hidden="true">{title.slice(0, 1)}</span> : null}
      </div>

      <div className="home-recipe-card__body">
        <h3>{title}</h3>
        {source && <p>{source}</p>}
        <p className="home-recipe-card__nutrition">
          {nutrition || "Nutrition not calculated"}
        </p>
      </div>
    </Link>
  );
}
