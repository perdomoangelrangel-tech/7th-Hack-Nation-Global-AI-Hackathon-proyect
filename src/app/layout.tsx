import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `${site.name} · Atlas de enfermedades raras con evidencia`,
  description: "Grafo de conocimiento con evidencia y agentes de voz que nunca inventan. Reto 5, Hack-Nation 7.",
  openGraph: { title: site.name, description: site.tagline, type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
