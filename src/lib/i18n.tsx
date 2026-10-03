"use client";
/**
 * Tiny EN/ES switch. Each surface keeps its own copy file ({ en: {...}, es: {...} })
 * and reads the active language with useLang(). English is the default (judges are global).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "es";
const KEY = "nedamex.lang";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    const initial: Lang = stored === "es" || stored === "en" ? stored : navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from the browser once
    setLangState(initial);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
  }, []);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() { return useContext(Ctx); }

/** Pick the right copy object for the active language. */
export function useCopy<T>(copy: { en: T; es: T }): T {
  const { lang } = useLang();
  return copy[lang];
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label="Language / Idioma" className={`inline-flex rounded-full border border-rule p-0.5 ${className}`}>
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-9 min-w-11 rounded-full px-3 font-display text-sm font-bold uppercase transition-colors ${lang === l ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
