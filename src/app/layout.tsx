import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/site";
import { PrefsProvider } from "@/lib/prefs";

export const metadata: Metadata = {
  title: `${site.name} · AI atlas for rare diseases`,
  description: "Evidence knowledge graph for rare diseases: shared mechanisms, reusable assets, collaborators and a next step — every edge with its source. Hack-Nation 7 · Challenge 5.",
  applicationName: site.name,
  authors: [{ name: site.company }],
  publisher: site.company,
  openGraph: { title: `${site.name} by ${site.company}`, description: site.tagline, type: "website", siteName: site.name },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased"><PrefsProvider>{children}</PrefsProvider></body>
    </html>
  );
}
