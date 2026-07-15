import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Recipe Library", description: "A private recipe library for browsing, cooking and sharing." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }