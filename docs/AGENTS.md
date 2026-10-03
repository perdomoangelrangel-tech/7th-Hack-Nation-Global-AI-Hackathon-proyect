# Personas, narración y voz

Cuatro perfiles = las cuatro personas del reto. **No tienen conocimiento propio**: narran solo los HECHOS numerados que el servidor arma desde el grafo (`src/lib/atlas/narrate.ts`), y el verificador borra cualquier frase que cite un hecho inexistente. Definición en `src/lib/agents/profiles.ts`.

| | Maria | Devon | Priya | Dr. Osei |
| --- | --- | --- | --- | --- |
| Quién | Líder de organización de pacientes | Cuidador con diagnóstico reciente | Exploradora biotech / farma | Clínico-científico |
| Qué oye primero | conexión → vía → activo → colaborador → paso | ¿hay comunidad? → conexión → activo → tratamiento | vía → efecto de variante → vecinas → tratamientos | gen → efecto de variante → vía → contraejemplos |
| Tono | Clara, cálida, estratégica | Suave, sin jerga, reconoce la emoción | Concisa, analítica, con identificadores | Precisa, escéptica, observación vs. inferencia |
| Voz OpenAI (`gpt-4o-mini-tts`) | `marin` | `coral` | `cedar` | `ash` |
| Máx. frases | 7 | 6 | 7 | 7 |

## Reglas que comparten (resumen)

1. Solo afirma lo que dicen los HECHOS; cada frase cita sus `fact_ids`.
2. Hechos INFERIDOS se dicen como hipótesis ("el atlas sugiere", "lo debe revisar un experto").
3. Hechos HUECO se dicen como ausencias, con qué evidencia lo cambiaría.
4. Sin consejo médico ni dosis; un fármaco aprobado en una enfermedad vecina es una pregunta para un experto.
5. Frases cortas para voz, sin listas ni URLs; responde en el idioma elegido (EN/ES).

## Cómo suena y cómo se sincroniza

`/api/narrate` devuelve frases verificadas con `nodes` y `edges`. La UI (`useNarration`) pide el audio de cada frase a `/api/speak` (precargando la siguiente), ilumina en el grafo los nodos/aristas de esa frase y muestra sus citas. Sin clave: voz del navegador con tiempo mínimo de lectura y protección contra voces colgadas.

## Herramientas para agentes externos

`/api/tools/{disease|trials|treatments|literature|communities|gaps|phenotype-match}` devuelven `{ data, evidence[] }` del mismo grafo. Si se define `ATLAS_TOOLS_KEY`, exigen el header `x-atlas-key`. Sirven para conectar cualquier agente de voz (p. ej. Realtime) sin cambiar el contrato.
