/** Operaciones de edición sobre el AST. Mutan el árbol; la UI reasigna
 * `program` para disparar reactividad y recalcular diagrama + código. */
import type { Program, Stmt } from './ast';
import { childLists } from './ast';

export type Branch = 'then' | 'else' | 'body';

/** Devuelve la lista de sentencias de un bloque: top-level (parentId null) o
 * una rama de un control (then/else/body). */
export function getBlock(program: Program, parentId: string | null, branch: Branch = 'body'): Stmt[] | null {
	if (parentId === null) return program.body;
	const owner = findStmt(program.body, parentId);
	if (!owner) return null;
	if (owner.kind === 'if') return branch === 'else' ? owner.else : owner.then;
	if (owner.kind === 'while' || owner.kind === 'for' || owner.kind === 'dowhile') return owner.body;
	return null;
}

export function findStmt(body: Stmt[], id: string): Stmt | undefined {
	for (const s of body) {
		if (s.id === id) return s;
		for (const list of childLists(s)) {
			const f = findStmt(list, id);
			if (f) return f;
		}
	}
	return undefined;
}

/** Elimina la sentencia `id` esté donde esté. Devuelve true si la quitó. */
export function removeStmt(body: Stmt[], id: string): boolean {
	const i = body.findIndex((s) => s.id === id);
	if (i >= 0) {
		body.splice(i, 1);
		return true;
	}
	for (const s of body) {
		for (const list of childLists(s)) if (removeStmt(list, id)) return true;
	}
	return false;
}

/** Mueve una sentencia una posición arriba/abajo dentro de su propio bloque. */
export function moveStmt(body: Stmt[], id: string, dir: -1 | 1): boolean {
	const i = body.findIndex((s) => s.id === id);
	if (i >= 0) {
		const j = i + dir;
		if (j < 0 || j >= body.length) return false;
		[body[i], body[j]] = [body[j], body[i]];
		return true;
	}
	for (const s of body) {
		for (const list of childLists(s)) if (moveStmt(list, id, dir)) return true;
	}
	return false;
}
