import Link from "next/link";

type HomeRecipeCardProps = {
  title: string;
  image: string | null;
  href: string;
};

export function HomeRecipeCard({ title, image, href }: HomeRecipeCardProps) {
  return (
    <Link className="home-recipe-card" href={href}>
      <div
        className={`home-recipe-card__image ${
          image ? "" : "home-recipe-card__image--empty"
        }`}
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
      >
        {!image ? <span aria-hidden="true">{title.slice(0, 1)}</span> : null}
      </div>

      <h3 className="home-recipe-card__title">{title}</h3>
    </Link>
  );
}
