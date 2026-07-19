"use client";

import Link from "next/link";
import { LogIn, LogOut, Menu, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const links = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/week", label: "This week" },
];

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { loading, isAdmin, signOut } = useAuth();
  const navigationLinks = isAdmin
    ? [...links, { href: "/paste", label: "Add recipe" }]
    : links;

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="app-header__brand" href="/" onClick={() => setOpen(false)}>
          Recipe Library
        </Link>

        <nav
          aria-label="Primary navigation"
          className={`app-header__nav ${open ? "app-header__nav--open" : ""}`}
        >
          {navigationLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : undefined}
                href={link.href}
                key={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-header__actions">
          <Link
            aria-label="Search recipes"
            className="app-header__search"
            href="/browse"
          >
            <Search aria-hidden="true" size={18} />
          </Link>

          {!loading &&
            (isAdmin ? (
              <button
                aria-label="Sign out of administrator mode"
                className="app-header__auth"
                onClick={() => void signOut()}
                type="button"
              >
                <LogOut aria-hidden="true" size={16} />
                <span>Sign out</span>
              </button>
            ) : (
              <Link className="app-header__auth" href="/login">
                <LogIn aria-hidden="true" size={16} />
                <span>Admin</span>
              </Link>
            ))}

          <button
            aria-expanded={open}
            aria-label={open ? "Close navigation" : "Open navigation"}
            className="app-header__menu"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
