import { writable } from 'svelte/store';

/** id de la sentencia (stmtId) que el intérprete está ejecutando ahora. */
export const activeStmtId = writable<string | null>(null);

/** Conjunto de bloques seleccionados (selección múltiple). */
export const selection = writable<Set<string>>(new Set());

export function selectOnly(id: string) {
	selection.set(new Set([id]));
}
export function toggleSelect(id: string) {
	selection.update((s) => {
		const n = new Set(s);
		if (n.has(id)) n.delete(id);
		else n.add(id);
		return n;
	});
}
export function clearSelection() {
	selection.set(new Set());
}
