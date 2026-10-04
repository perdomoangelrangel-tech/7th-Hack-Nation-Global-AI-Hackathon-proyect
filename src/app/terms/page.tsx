import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/landing/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: `Terms of Use · ${site.name}`, description: `Terms of Use for ${site.name}, the rare disease evidence atlas.` };

const sections: LegalSection[] = [
  { title: "1. What Nedamex is", paragraphs: ["Nedamex is a research and information tool: an evidence graph that links rare diseases, genes, mechanisms, symptoms, studies, medicines, patient groups and researchers, and shows the public source behind every link. It is a prototype and may change or be unavailable at any time."] },
  { title: "2. Not medical advice", paragraphs: ["Nedamex does not provide medical advice, diagnosis or treatment, and it never shows doses. Information about medicines, trials or \"approved\" status describes what public sources say; whether anything fits a person is a decision for their clinician. \"Inferred\" links are hypotheses that an expert must review; \"AI-extracted\" links need expert review; community drafts are never evidence. In an emergency, contact your local emergency number."] },
  { title: "3. Sources, accuracy and AI", paragraphs: ["Data comes from public sources (Orphanet, HPO, ClinVar, PubMed, ClinicalTrials.gov, Open Targets, NIH RePORTER, Reactome, Monarch, openFDA/DailyMed, EMA and verified patient-organization sites), each under its own license, credited on the site. Explanations are generated with OpenAI models and checked by a verifier that removes any sentence without a citation, but errors can remain. Always check the linked source. Nedamex is provided \"as is\", without warranties of any kind."] },
  { title: "4. Community contributions", paragraphs: ["If you submit a profile, a research project, a disease request or a source suggestion:"], bullets: [
    "it is self-declared, not verified and not evidence, and it may be shown publicly;",
    "do not include personal health information about you or anyone else, or anyone's private contact details;",
    "you confirm you have the right to share it and that it is accurate to the best of your knowledge;",
    "we may edit, hide or remove any contribution at any time (for example spam, abuse, or wrong information).",
    "Roles (patient, family, researcher & clinician, pharma) are self-declared in this prototype.",
  ] },
  { title: "5. Acceptable use", paragraphs: ["Do not attempt to break, overload or bypass the security of Nedamex or its providers; scrape it in a way that degrades the service; use the listed researchers' or organizations' information for spam or harassment; submit malicious, unlawful or misleading content; or use Nedamex to impersonate anyone."] },
  { title: "6. Researcher information", paragraphs: ["Researcher entries come from public grant records (NIH RePORTER) and public trial or publication records. No private contact details are shown. To request a correction or removal, open an issue in our repository."] },
  { title: "7. Liability", paragraphs: ["To the extent allowed by law, the Nedamex team is not liable for any decision taken on the basis of information shown in Nedamex or for any indirect or consequential damages arising from its use."] },
  { title: "8. Changes", paragraphs: ["We may update these terms; the date above shows the latest version."] },
  { title: "9. Contact", paragraphs: [
    `Nedamex team — ${site.team.map((m) => `${m.name} (${m.role})`).join(", ")}.`,
    `Questions, corrections and removal requests: GitHub issues at ${site.github}. Security reports: see the Security & Privacy page.`,
  ] },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      updated="October 4, 2026"
      intro="These terms apply to the Nedamex website (nedamex.vercel.app), the Nedamex platform (nedamex.lovable.app), the embedded atlas, its voice and chat guides, and its public APIs (together, “Nedamex”). By using Nedamex you agree to them. If you do not agree, please do not use Nedamex."
      sections={sections}
    />
  );
}
