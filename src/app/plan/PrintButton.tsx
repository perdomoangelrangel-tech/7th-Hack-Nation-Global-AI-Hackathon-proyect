"use client";
export function PrintButton({ label }: { label: string }) {
  return <button onClick={() => window.print()} className="rounded-full bg-brand-deep px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-ink">{label}</button>;
}
