/**
 * Nedamex mark: the letter N drawn as a transit route with four stations.
 * Three stations are sourced (gene · symptom · treatment colors); the last one is hollow:
 * a gap we refuse to fill with guesses.
 */
export function LogoMark({ size = 32, title = "Nedamex" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title}>
      <path d="M12 37 V11 L37 36 V11" fill="none" stroke="var(--ink)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="37" r="5" fill="var(--l-gene)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="12" cy="11" r="5" fill="var(--l-pheno)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="37" cy="36" r="5" fill="var(--l-treat)" stroke="var(--ink)" strokeWidth="2.5" />
      <circle cx="37" cy="11" r="5" fill="var(--canvas)" stroke="var(--ink)" strokeWidth="2.5" strokeDasharray="3 2.4" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-display font-extrabold tracking-tight text-[1.35rem] leading-none lowercase">nedamex</span>
    </span>
  );
}
