"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return <main className="admin-gate">Checking administrator access…</main>;
  }

  if (!isAdmin) {
    return (
      <main className="admin-gate">
        <p className="eyebrow">Administrator only</p>
        <h1>Sign in to manage the recipe library.</h1>
        <Link className="button button--dark" href="/login">
          Administrator login
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
