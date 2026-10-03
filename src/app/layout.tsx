import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Atkinson_Hyperlegible_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { PrefsProvider } from "@/lib/prefs";

// Body: Atkinson Hyperlegible (Braille Institute) — many rare diseases affect sight. Display: Fraunces. Codes: Atkinson Mono.
const atkinson = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin", "latin-ext"], variable: "--font-atkinson", display: "swap" });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-atkinson-mono", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · AI atlas for rare diseases`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.company }],
  creator: site.company,
  publisher: site.company,
  manifest: "/site.webmanifest",
  openGraph: { title: `${site.name} by ${site.company}`, description: site.tagline, type: "website", siteName: site.name, locale: "en_US" },
  twitter: { card: "summary_large_image", title: `${site.name} by ${site.company}`, description: site.tagline },
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${atkinsonMono.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased"><PrefsProvider>{children}</PrefsProvider></body>
    </html>
  );
}
