import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} · An evidence-backed atlas for rare diseases`,
  description: "Search a rare disease and follow it to a shared mechanism, an existing asset, a collaborator and a next step — every edge with its source. Hack-Nation 7, Challenge 5.",
  openGraph: { title: site.name, description: site.taglineEn, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
