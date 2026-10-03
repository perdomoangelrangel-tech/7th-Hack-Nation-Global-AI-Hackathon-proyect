/** Color por tipo de nodo. Compartido por el canvas (solo cliente) y los componentes que se renderizan en el servidor. */
export const TYPE_COLOR: Record<string, string> = {
  gene: "#7dd3fc", pathway: "#c4b5fd", phenotype: "#94a3b8", organization: "#fbbf24",
  trial: "#5eead4", investigator: "#f9a8d4", treatment: "#86efac", study: "#cbd5e1", variant: "#cbd5e1",
};
