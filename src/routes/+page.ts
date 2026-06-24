// El editor es 100% client-side (estado $state, drag-and-drop, intérprete en el
// navegador). Desactivamos SSR de esta página; el resto del backend (hooks, auth,
// endpoints) corre en el server con adapter-node.
export const ssr = false;
