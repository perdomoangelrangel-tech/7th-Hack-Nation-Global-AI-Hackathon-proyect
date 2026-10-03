# Entrega · diagnóstico contra la rúbrica del Reto 5

Documento interno del equipo. Qué tenemos, qué evalúa el jurado, qué falta y en qué orden.

## 1. Qué funciona hoy (verificado)

- **App completa sin claves ni base de datos**: `npm install && npm run dev` → `/atlas`. Typecheck, lint, 16 tests y build de producción en verde.
- **Grafo real** en `data/atlas.json`: 9 enfermedades, 2,270 aristas, 2,512 registros de evidencia de 10 fuentes públicas (Orphanet, HPO, Monarch, ClinVar, ClinicalTrials.gov, Open Targets, Reactome, PubMed, NIH RePORTER, grupos de pacientes).
- **Análisis**: similitud por síntomas ponderados por especificidad (simGIC), vías Reactome y genes → 3 clusters con sentido biológico (canales/sinapsis, tipo Rett, lisosomal), centralidad, puentes, huecos y contraejemplos.
- **Recorrido de Maria** (STXBP1): conexión con KCNQ2-DEE y Dravet → un registro de historia natural que ya incluye a 4 de estas enfermedades → investigadores que ya trabajan en ambas → plan con siguientes pasos, cada uno con su evidencia.
- **Voz que describe el grafo**: al elegir una enfermedad la voz narra; cada frase ilumina sus nodos, hace viajar partículas por la arista citada y muestra sus fuentes. 4 personas (Maria, Devon, Priya, Dr. Osei), EN/ES.
- **Integridad**: observado / inferido / extraído siempre distinguidos; verificador determinista; evidencia en contra visible (ensayos detenidos, conflictos en ClinVar, sitios no verificados); cobertura de búsqueda.

Errores corregidos del repo original: 3 códigos MONDO y 1 ORPHA equivocados en el seed; `knownDrugs` ya no existe en Open Targets (los tratamientos se perdían en silencio); Open Targets bloqueaba sin user-agent; Orphanet sin genes para 4 enfermedades (ahora respaldo Monarch); una relación sin fuente (Buffalo Initiative "investiga" las 5 enfermedades) eliminada.

## 2. Rúbrica, criterio por criterio

| Criterio | Estado | Evidencia en el producto | Qué falta |
| --- | --- | --- | --- |
| **Graph quality** | 🟢 | Nodos y aristas con tipo; clusters defendibles (método documentado y determinista); caminos útiles; contraejemplos; incertidumbre explícita | Correr `npm run extract` con la clave para sumar activos extraídos de artículos |
| **Evidence integrity** | 🟢 | Fuente + fecha en cada arista; inferido ≠ observado; citas literales verificadas en extracción; verificador; tests | — |
| **Patient progress** | 🟢 | Diagnóstico aislado → colaboración justificada → activo reutilizable → siguiente paso; hueco honesto si no hay pista | Que el video lo muestre en 1 minuto |
| **10× impact** | 🟡 | Sección en la landing con hito (cohorte de historia natural compartida), tabla hoy vs. con el atlas y supuestos | Validar 1–2 supuestos con un grupo de pacientes real (aunque sea una conversación) y decirlo en el video |
| **Ambition & product craft** | 🟢 | Constelación animada, voz por persona, búsqueda con sinónimos, inspector de aristas, móvil | Clave de OpenAI para la voz real |
| **Built with OpenAI** (premio del track) | 🟡 | Narración (Responses + Structured Outputs), voz (gpt-4o-mini-tts), extracción y nombres de clusters ya programados | **Poner la clave** y correr `extract` + `analyze` |
| **Working prototype desplegado** | 🔴 | Corre local | **Desplegar en Vercel** |
| **Repo con README de arquitectura y dataset** | 🟢 | README + docs/ARCHITECTURE.md + docs/DATA_SOURCES.md | — |
| **Team video + walkthrough de 1 min** | 🔴 | Espacios listos en la landing (`NEXT_PUBLIC_VIDEO_*`) | **Grabarlos** |

## 3. Checklist para entregar (en orden)

1. **Clave de OpenAI** → pegarla en `.env.local` (`OPENAI_API_KEY=`). Nunca en el chat, nunca con prefijo `NEXT_PUBLIC_`, nunca en git (`.env*` está ignorado). Si alguna vez se expone, rotarla en platform.openai.com.
2. `npm run dev` → abrir `/api/health`: debe decir `narration: openai (gpt-6-luna)` y `voice: openai (gpt-4o-mini-tts)`.
3. `npm run extract && npm run analyze` → suma activos extraídos con cita verificada y nombres de clusters en lenguaje claro. Revisar `git diff --stat data/atlas.json` y hacer commit.
4. **Vercel**: importar el repo → Settings → Environment Variables → `OPENAI_API_KEY` (Production y Preview). Sin Supabase. Probar `/atlas` y `/api/health` en la URL pública.
5. En OpenAI, poner un **límite de gasto** del proyecto (los endpoints de voz son públicos; ya tienen caché de CDN y límite por IP).
6. Grabar el walkthrough (guion abajo) y el video del equipo; subirlos y poner sus URLs en `NEXT_PUBLIC_VIDEO_DEMO/TECH/TEAM` en Vercel.
7. Probar en un navegador limpio (incógnito) y en el teléfono.

Costo estimado por narración con la clave: texto ≈ $0.001 (gpt-6-luna); voz ≈ 1–2 centavos la primera vez y ~0 después (la CDN guarda el audio de cada frase). La extracción completa (≈54 abstracts) cuesta centavos.

## 4. Guion del walkthrough (60 s)

| Seg. | Pantalla | Voz en off |
| --- | --- | --- |
| 0–8 | Landing → "Follow Maria's case" | "Maria lidera un grupo de pacientes de STXBP1. No hay tratamiento aprobado. Escribe su enfermedad." |
| 8–25 | La constelación se reordena; la voz del atlas narra; se encienden STXBP1 y KCNQ2 | (dejar hablar al atlas: conexión inferida, síntomas compartidos, misma familia de mecanismo) |
| 25–35 | Clic en la arista → inspector (fuentes, "inferred", evidencia en contra) | "Cada conexión dice de dónde viene y qué tan segura es." |
| 35–45 | Pestaña Assets → registro de historia natural compartido con Dravet/CDKL5/FOXG1 | "Ya existe un estudio que incluye a cuatro de estas comunidades." |
| 45–55 | People + Next steps | "Y hay investigadores que ya trabajan en ambas. Este es el plan para esta semana." |
| 55–60 | Cambiar a CLN2 (contraejemplo) o a Devon en español | "Si no hay pista respaldada, el atlas lo dice y explica qué evidencia falta." |

## 5. Sobre el documento de pitch que compartieron

**Sí conviene (ya está en el producto o cuesta poco):**
- Voz personalizable paciente vs. investigador → hecho, y mejor: las 4 personas del reto con voz y orden propios.
- Trazabilidad con IDs (PMID, ORPHA, NCT…) y camino visual → hecho (inspector de aristas + citas bajo cada frase).
- Sector/audiencias/modelo B2B → útil para el video del equipo, ya está en `docs/RESEARCH.md`. Una diapositiva, no más.

**Ajustar:**
- El pitch se centra en la *odisea diagnóstica*. El reto **no es de diagnóstico**: es que un grupo de pacientes **avance hacia un tratamiento** (conexión → activo → colaborador → siguiente paso). Reencuadrar el problema así.
- La estructura de 3 minutos dedica 45 s a negocio, pero los criterios del jurado no incluyen modelo de negocio y sí **10× impact**. Cambiar ese bloque por el hito 10× y sus supuestos.
- Lo que se entrega son **un video del equipo y un walkthrough de 1 minuto**, no un pitch de 3 minutos.
- Las cifras deben tener fuente. Las del brief son: 10,000 enfermedades raras, 80 % genéticas, 5,000 monogénicas, 350 M de personas, < 5 % con tratamiento aprobado. "4–7 años de diagnóstico" necesita su fuente (EURORDIS reporta 4.7 años en promedio) o quitarse.
- La tabla de inversión es una estimación sin fuente: presentarla como tal, o mejor omitirla; no es un criterio.

**No conviene en el tiempo del hackathon (dejar como roadmap):**
- Plataforma colaborativa en tiempo real / hipótesis abiertas: autenticación, moderación y tiempo real son semanas de trabajo. Como mucho, mencionar "los grupos podrán aportar evidencia faltante" (stretch goal del brief).
- Matchmaking de pacientes con ensayos: implica datos de pacientes, consentimiento y regulación (HIPAA/GDPR). Riesgo alto de hacer promesas que no podemos sostener.
- Migrar a Neo4j/Memgraph: no aporta nada en este tamaño; el modelo ya está en Postgres para escalar.

## 6. Riesgos conocidos

- 9 enfermedades: es una demostración del método, no un censo; decirlo.
- La identidad de investigadores por PubMed es por nombre (se muestra con confianza baja); la de NIH es estable.
- Los pesos de la similitud son razonados, no ajustados: cada conexión inferida se marca para revisión experta.
- Las definiciones de Orphanet están en inglés; la UI en español traduce etiquetas y narración, no el texto fuente.
