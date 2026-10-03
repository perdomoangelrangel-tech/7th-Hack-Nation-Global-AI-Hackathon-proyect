/** El flujo del producto como ilustración. Mismo recorrido que docs/ARCHITECTURE.md. */
const INK = "var(--ink)", INK3 = "var(--ink-3)", LINE = "var(--line)", TEAL = "var(--teal)", AMBER = "var(--amber)";

function Box({ x, y, w = 200, h = 64, title, sub, accent }: { x: number; y: number; w?: number; h?: number; title: string; sub: string; accent?: "teal" | "amber" }) {
  const fill = accent === "teal" ? "var(--teal-soft)" : accent === "amber" ? "var(--amber-soft)" : "var(--paper-2)";
  const stroke = accent === "teal" ? TEAL : accent === "amber" ? AMBER : LINE;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={stroke} strokeWidth={accent ? 2 : 1.25} />
      <text x={x + w / 2} y={y + 27} textAnchor="middle" fontSize="14" fontWeight="600" fill={INK}>{title}</text>
      <text x={x + w / 2} y={y + 46} textAnchor="middle" fontSize="11.5" fill={INK3}>{sub}</text>
    </g>
  );
}

function Arrow({ d, dashed }: { d: string; dashed?: boolean }) {
  return <path d={d} fill="none" stroke={LINE} strokeWidth="1.5" markerEnd="url(#arr)" className={dashed ? "flow-dash" : undefined} />;
}

export function FlowDiagram() {
  return (
    <svg viewBox="0 0 760 420" role="img" aria-label="No answer reaches the user without passing the verifier" className="w-full h-auto">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={LINE} />
        </marker>
      </defs>
      {/* fila 1 */}
      <Box x={20} y={30} title="Ingest" sub="10 open sources, verified" />
      <Box x={280} y={30} title="Evidence graph" sub="source + date on every edge" accent="teal" />
      <Box x={540} y={30} title="Search a disease" sub="name, gene, symptom, group" />
      <Arrow d="M220 62 H280" />
      <Arrow d="M640 94 V150" />
      {/* fila 2 */}
      <Box x={540} y={150} title="OpenAI narration" sub="writes only from numbered facts" />
      <Box x={280} y={150} title="Analysis" sub="clusters · bridges · gaps" />
      <Arrow d="M540 182 H480" />
      <Arrow d="M380 150 V94" dashed />
      <text x={392} y={128} fontSize="11" fill={INK3}>reads</text>
      {/* verificador */}
      <polygon points="380,250 460,300 380,350 300,300" fill="var(--paper-2)" stroke={INK} strokeWidth="1.5" />
      <text x="380" y="296" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={INK}>Does each</text>
      <text x="380" y="312" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={INK}>sentence cite?</text>
      <Arrow d="M380 214 V250" />
      {/* salidas */}
      <Box x={540} y={268} title="Spoken + graph lights up" sub="citations under each sentence" accent="teal" />
      <Box x={20} y={268} title="Sentence deleted" sub="gaps are said, never invented" accent="amber" />
      <Arrow d="M460 300 H540" />
      <Arrow d="M300 300 H220" />
      <text x="492" y="292" fontSize="11" fill={TEAL} fontWeight="600">yes</text>
      <text x="252" y="292" fontSize="11" fill={AMBER} fontWeight="600">no</text>
      {/* siguientes pasos */}
      <Arrow d="M640 332 V370" />
      <rect x={480} y={370} width={260} height={34} rx="10" fill="var(--paper)" stroke={LINE} />
      <text x={610} y={392} textAnchor="middle" fontSize="12" fill={INK}>connection · asset · collaborator · next step</text>
    </svg>
  );
}
