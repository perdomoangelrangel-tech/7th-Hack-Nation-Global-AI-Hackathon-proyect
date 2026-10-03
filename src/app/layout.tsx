import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@/lib/site";
import { LangProvider } from "@/lib/i18n";

const overpass = localFont({ src: "./fonts/overpass.woff2", variable: "--font-overpass", weight: "100 900", display: "swap" });
const overpassMono = localFont({ src: "./fonts/overpass-mono.woff2", variable: "--font-overpass-mono", weight: "300 700", display: "swap" });
const atkinson = localFont({ src: "./fonts/atkinson.woff2", variable: "--font-atkinson", weight: "200 800", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nedamex.vercel.app"),
  title: { default: `${site.name} · Rare disease, mapped`, template: `%s · ${site.name}` },
  description: "An evidence graph of rare diseases with voice agents that never invent. Every answer traced to its source.",
  openGraph: { title: `${site.name} · Rare disease, mapped`, description: site.promise.en, type: "website" },
  twitter: { card: "summary_large_image", title: site.name, description: site.promise.en },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#14161f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable} ${atkinson.variable}`}>
      <body className="min-h-dvh antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
