import Link from "next/link";
import { site } from "@/lib/site";
import { FlowDiagram } from "@/components/FlowDiagram";
import { VideoSlot } from "@/components/VideoSlot";

const SOURCES = ["Orphanet", "HPO", "Monarch", "ClinVar", "ClinicalTrials.gov", "Open Targets", "PubMed"];

const AUDIENCES = [
  { title: "Familias", who: "pacientes y cuidadores · gratis", desc: "Una guía cálida que explica la enfermedad, los tratamientos documentados, los ensayos cercanos y los grupos de apoyo.", agent: "Guía de familias", tone: "teal" },
  { title: "Clínicas", who: "médicos y genetistas · B2B", desc: "Un analista que ordena diferenciales por fenotipo (HPO), variantes relevantes y literatura, con códigos y citas.", agent: "Analista clínico", tone: "navy" },
  { title: "Investigación", who: "fundaciones, farma, CROs · B2B", desc: "Un analista que muestra el mapa de evidencia, los huecos de investigación y la comunidad que ya trabaja en cada enfermedad.", agent: "Analista de investigación", tone: "navy" },
];

const NUMBERS = [
  { n: "4.7 años", t: "tarda en promedio un diagnóstico confirmado", s: "EURORDIS, 10,453 pacientes" },
  { n: "95%", t: "de las enfermedades raras no tiene tratamiento aprobado", s: "Buffalo Initiative" },
  { n: "300M+", t: "personas viven con una enfermedad rara", s: "Rare Diseases International" },
];

export default function Home() {
  return (
    <main>
      {/* Nav */}
      <header className="sticky top-0 z-20 backdrop-blur bg-paper/80 border-b border-line">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <span className="font-semibold tracking-tight">
            <span className="inline-block w-5 h-5 rounded-md border border-dashed border-ink-3 align-[-3px] mr-2" aria-hidden title="logo pendiente" />
            {site.name}
          </span>
          <nav className="flex items-center gap-5 text-sm text-ink-2">
            <a href="#flujo" className="hover:text-ink">Cómo funciona</a>
            <a href="#videos" className="hover:text-ink">Videos</a>
            <a href={site.github} className="hover:text-ink" target="_blank" rel="noreferrer">GitHub</a>
            <Link href="/atlas" className="rounded-full bg-navy text-paper px-4 py-1.5 font-medium">Abrir el atlas</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-12 grid lg:grid-cols-[1.1fr_.9fr] gap-10 items-center">
        <div>
          <p className="chip mb-5">{site.challenge}</p>
          <h1 className="serif text-5xl md:text-6xl leading-[1.05] text-navy">
            Cada respuesta rara, <br /><span className="text-teal">con su fuente.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-2 max-w-xl">
            Un atlas que conecta enfermedades, genes, síntomas, tratamientos, ensayos y comunidades en un grafo
            construido solo con bases de datos verificadas. Agentes de voz con personalidad lo explican a cada público.
            Si no hay evidencia, lo dicen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/atlas" className="rounded-full bg-teal text-white px-6 py-3 font-medium">Probar el atlas</Link>
            <a href="#videos" className="rounded-full border border-line px-6 py-3 font-medium hover:bg-paper-2">Ver el demo</a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Fuentes de datos">
            {SOURCES.map((s) => <li key={s} className="chip"><span className="w-1.5 h-1.5 rounded-full bg-teal" aria-hidden />{s}</li>)}
          </ul>
        </div>

        {/* Ilustración: respuesta con evidencia vs sin evidencia */}
        <div className="card p-5 space-y-3" aria-label="Ejemplo de respuesta">
          <p className="text-xs uppercase tracking-widest text-ink-3">Guía de familias · ejemplo</p>
          <p className="text-sm text-ink-2 italic">&ldquo;¿Qué tratamientos hay para el síndrome de Rett?&rdquo;</p>
          <div className="evidence pl-3 py-1">
            <p className="text-sm">Trofinetide aparece como tratamiento aprobado para el síndrome de Rett.</p>
            <p className="text-xs text-ink-3 mt-1">Open Targets · CHEMBL · consultado hoy</p>
          </div>
          <div className="evidence pl-3 py-1">
            <p className="text-sm">Hay 6 ensayos activos reclutando en 4 países.</p>
            <p className="text-xs text-ink-3 mt-1">ClinicalTrials.gov · NCT… · consultado hoy</p>
          </div>
          <div className="no-evidence pl-3 py-2 rounded-r-md">
            <p className="text-sm">No hay evidencia en nuestras fuentes sobre dietas que curen la enfermedad, así que no lo incluyo.</p>
          </div>
          <p className="text-xs text-ink-3">Esto es información con fuentes, no un diagnóstico. Llévalo a tu médico o a un centro experto.</p>
        </div>
      </section>

      {/* Problema en números */}
      <section className="border-y border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-10 grid md:grid-cols-3 gap-8">
          {NUMBERS.map((x) => (
            <div key={x.n}>
              <p className="serif text-4xl text-navy">{x.n}</p>
              <p className="text-ink-2 mt-1">{x.t}</p>
              <p className="text-xs text-ink-3 mt-1">{x.s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flujo */}
      <section id="flujo" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="serif text-3xl text-navy">Ninguna respuesta llega sin pasar por el verificador</h2>
        <p className="mt-3 text-ink-2 max-w-2xl">La IA no tiene conocimiento propio. Solo puede decir lo que el grafo respalda con una fuente y una fecha; un verificador determinista elimina cualquier frase sin cita antes de convertirla en voz.</p>
        <div className="card mt-8 p-4 md:p-8"><FlowDiagram /></div>
      </section>

      {/* Públicos */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="serif text-3xl text-navy">Tres públicos, tres voces, un mismo grafo</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-5">
          {AUDIENCES.map((a) => (
            <article key={a.title} className="card p-6">
              <p className="text-xs uppercase tracking-widest text-ink-3">{a.who}</p>
              <h3 className="mt-2 text-xl font-semibold">{a.title}</h3>
              <p className="mt-2 text-ink-2 text-sm">{a.desc}</p>
              <p className="mt-4 chip"><span className={`w-2 h-2 rounded-full ${a.tone === "teal" ? "bg-teal" : "bg-navy"}`} aria-hidden />{a.agent}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Videos */}
      <section id="videos" className="border-t border-line bg-paper-2">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="serif text-3xl text-navy">Videos de la entrega</h2>
          <p className="mt-2 text-ink-2">Las URLs se configuran en <code className="text-xs">NEXT_PUBLIC_VIDEO_*</code>; mientras tanto se muestran los espacios.</p>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            <VideoSlot index={1} title="Demo" purpose="El producto funcionando de principio a fin" url={site.videos.demo} />
            <VideoSlot index={2} title="Técnico" purpose="Grafo, verificador, agentes y cómo escala" url={site.videos.tech} />
            <VideoSlot index={3} title="Equipo" purpose="Quiénes somos y por qué este problema" url={site.videos.team} />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-3 flex flex-wrap gap-4 justify-between">
        <p>{site.name} · {site.challenge}</p>
        <p>Información con fuentes, no consejo médico. Nunca vendemos datos de pacientes.</p>
      </footer>
    </main>
  );
}
