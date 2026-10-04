/**
 * "How to use the platform" — 3 steps, same metaphors as the app (lucide icons from @/lib/icons). Server-safe.
 */
import Link from "next/link";
import { ICON, KIND_ICON, MODE_ICON, NAV_ICON, STEP_ICON } from "@/lib/icons";
import { site } from "@/lib/site";

const Role = MODE_ICON.maria;
const Search = NAV_ICON.search;
const Route = STEP_ICON[3];
const Proof = KIND_ICON.observed;

const STEPS = [
  { icons: [Role], title: "Pick your role", body: "Patient or caregiver, family & patient group, researcher, or pharma & biotech. You can switch anytime." },
  { icons: [Search, Route], title: "Search your disease, follow your route", body: "Four questions, one at a time: who shares its biology, what already exists, who could help, what to do next." },
  { icons: [Proof], title: "Tap any line for its evidence", body: "Every link opens its sources, how sure we are, and anything that contradicts it." },
];

export function HowToUse() {
  return (
    <section id="how-to-use" aria-labelledby="how-to-use-title" className="border-b border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">How to use the platform</p>
            <h2 id="how-to-use-title" className="display mt-1 text-2xl font-semibold text-brand-ink sm:text-3xl">Three steps to your next step.</h2>
          </div>
          <Link href={site.appUrl} className="rounded-full bg-brand-deep px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-ink">Open {site.name}</Link>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-4 rounded-xl border border-line bg-brand-mist p-5">
              <span aria-hidden className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-deep text-lg font-semibold text-white">{i + 1}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-bold text-brand-ink">
                  {s.icons.map((Icon, k) => <Icon key={k} size={ICON.ui} strokeWidth={ICON.stroke} aria-hidden className="shrink-0 text-brand-deep" />)}
                  <span>{s.title}</span>
                </p>
                <p className="mt-1.5 text-sm text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
