import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: `Security & Privacy · ${site.name}`, description: `How ${site.name} protects data: encryption, least privilege and privacy by design.` };

// Every line here must be true on production. Add a claim only after it is live and verified (WAVE 7 rule).
const sections: LegalSection[] = [
  { title: "What we collect", bullets: [
    "No accounts and no advertising.",
    "Preferences (role, language, sounds, text size) stay in your own browser's local storage.",
    "Questions you type or say to the guide are sent to our AI providers only to produce an answer. We do not sell or share them.",
    "Community submissions (profile, research project, disease request, source suggestion) are stored only if you submit them and tick the consent box. Profiles are public by design; any optional contact detail is encrypted at rest and never shown publicly.",
  ] },
  { title: "How we protect it", bullets: [
    "Encryption in transit: every page and API is served over HTTPS/TLS.",
    "Encryption at rest: the database (Supabase Postgres) is encrypted at rest by the provider, and contact details are additionally encrypted column by column (pgcrypto, with the key held in Supabase Vault and decryptable only server-side).",
    "Least privilege: Row-Level Security on every table. The public key can only read public views and call validated, rate-limited submission functions; it cannot read contact data.",
    "Secrets never reach the browser: API keys (OpenAI, ElevenLabs) live only in server-side environment variables.",
    "Trustworthy answers: a citation verifier removes any sentence without a source, and red-team tests block doses, cure claims and personal data.",
    "Voice privacy: the ElevenLabs voice agents do not record audio; conversation transcripts are kept for 30 days and then deleted by the provider.",
  ] },
  { title: "Providers", paragraphs: ["Vercel (hosting) · Lovable (platform hosting) · Supabase (database) · OpenAI (language model API) · ElevenLabs (voice). Each processes data only to run Nedamex."] },
  { title: "Your choices", paragraphs: ["Do not submit personal health information. To correct or remove a contribution or a researcher entry, open a GitHub issue. You can turn sounds and the voice guide off at any time."] },
  { title: "Reporting a vulnerability", paragraphs: [`Please report security issues privately through GitHub's “Report a vulnerability” (Security tab of ${site.github}) rather than opening a public issue. Please do not access other people's data or degrade the service while testing.`] },
];

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security & Privacy"
      updated="October 4, 2026"
      intro="Nedamex handles rare-disease information, so privacy and integrity come first: minimal data, encryption, least privilege and sources for every claim."
      sections={sections}
      outro="This is a hackathon prototype; these measures describe its current setup and will be reviewed before any production use."
    />
  );
}
