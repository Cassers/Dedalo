import { writable } from 'svelte/store';

/** id de la sentencia (stmtId) que el intérprete está ejecutando ahora. */
export const activeStmtId = writable<string | null>(null);

/** stmtId del nodo seleccionado en el editor (para el panel de edición). */
export const selectedStmtId = writable<string | null>(null);
