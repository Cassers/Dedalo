// SPA: todo el render ocurre en el cliente (Svelte Flow no es SSR-friendly y el
// intérprete corre en el navegador). Sin prerender de páginas dinámicas.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
