import { writable } from 'svelte/store';
import type { Stmt } from './ir/ast';

/** Qué se está arrastrando: un bloque NUEVO de la paleta o uno EXISTENTE (mover). */
export type DragPayload =
	| { type: 'new'; kind: Stmt['kind'] }
	| { type: 'move'; id: string }
	| null;

export const dragging = writable<DragPayload>(null);

/** Portapapeles: bloques copiados (clonados con ids nuevos al pegar). */
export const clipboard = writable<Stmt[]>([]);
