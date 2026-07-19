import { ShoppingClient } from "./ShoppingClient";

type ShoppingPageProps = {
  searchParams: Promise<{ week?: string | string[] }>;
};

export default async function ShoppingPage({ searchParams }: ShoppingPageProps) {
  const params = await searchParams;
  const requested = Array.isArray(params.week) ? params.week[0] : params.week;
  return <ShoppingClient weekStart={requested ?? ""} />;
}
