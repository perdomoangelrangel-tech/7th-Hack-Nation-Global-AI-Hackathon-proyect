import type { atlas } from "../atlas/store";

/** The in-memory graph index (`atlas()`), passed explicitly so AI modules stay pure and testable. */
export type AtlasIndex = ReturnType<typeof atlas>;
export type Locale = "en" | "es";
