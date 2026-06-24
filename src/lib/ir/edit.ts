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

/** Saca la sentencia del árbol y la devuelve (para reubicarla). */
export function detachStmt(program: Program, id: string): Stmt | null {
	const s = findStmt(program.body, id);
	if (!s) return null;
	removeStmt(program.body, id);
	return s;
}

/** Inserta `stmt` en el bloque destino en la posición `index`. */
export function insertAt(
	program: Program,
	parentId: string | null,
	branch: Branch,
	index: number,
	stmt: Stmt
): boolean {
	const block = getBlock(program, parentId, branch);
	if (!block) return false;
	const i = Math.max(0, Math.min(index, block.length));
	block.splice(i, 0, stmt);
	return true;
}

/** ¿`ancestorId` contiene (directa o indirectamente) a `descId`? */
export function isAncestor(program: Program, ancestorId: string, descId: string): boolean {
	const a = findStmt(program.body, ancestorId);
	if (!a) return false;
	for (const list of childLists(a)) if (findStmt(list, descId)) return true;
	return false;
}

/** Mueve una sentencia existente al bloque destino en `index`. No permite
 * soltar un bloque dentro de sí mismo o de sus descendientes. */
export function moveTo(
	program: Program,
	id: string,
	parentId: string | null,
	branch: Branch,
	index: number
): boolean {
	if (id === parentId) return false;
	if (parentId !== null && isAncestor(program, id, parentId)) return false;

	// Ajuste de índice: si destino y origen son el mismo bloque y el origen está
	// antes del punto de inserción, al quitarlo se corre una posición.
	const sourceBlock = blockOf(program, id);
	const targetBlock = getBlock(program, parentId, branch);
	let idx = index;
	if (sourceBlock && targetBlock && sourceBlock === targetBlock) {
		const from = sourceBlock.findIndex((s) => s.id === id);
		if (from >= 0 && from < idx) idx -= 1;
	}

	const stmt = detachStmt(program, id);
	if (!stmt) return false;
	return insertAt(program, parentId, branch, idx, stmt);
}

/** Ubicación completa de una sentencia: bloque padre, rama e índice. */
export function locateFull(
	program: Program,
	id: string
): { parentId: string | null; branch: Branch; index: number } | null {
	const search = (body: Stmt[], parentId: string | null, branch: Branch): ReturnType<typeof locateFull> => {
		const i = body.findIndex((s) => s.id === id);
		if (i >= 0) return { parentId, branch, index: i };
		for (const s of body) {
			if (s.kind === 'if') {
				const a = search(s.then, s.id, 'then') ?? search(s.else, s.id, 'else');
				if (a) return a;
			} else if (s.kind === 'while' || s.kind === 'for' || s.kind === 'dowhile') {
				const a = search(s.body, s.id, 'body');
				if (a) return a;
			}
		}
		return null;
	};
	return search(program.body, null, 'body');
}

/** Sentencias seleccionadas que NO son descendientes de otra seleccionada,
 * en orden de documento (las "raíces" de la selección, para operar en grupo). */
export function selectionRoots(program: Program, ids: Set<string>): Stmt[] {
	const out: Stmt[] = [];
	const walk = (body: Stmt[], underSel: boolean) => {
		for (const s of body) {
			const sel = ids.has(s.id);
			if (sel && !underSel) out.push(s);
			for (const list of childLists(s)) walk(list, underSel || sel);
		}
	};
	walk(program.body, false);
	return out;
}

/** Mueve un grupo de bloques (por sus ids raíz) al destino, en orden. */
export function moveGroup(
	program: Program,
	ids: Set<string>,
	parentId: string | null,
	branch: Branch,
	index: number
): boolean {
	const roots = selectionRoots(program, ids);
	if (!roots.length) return false;
	// Guardas: no soltar dentro de sí mismo o de sus descendientes.
	for (const r of roots) {
		if (r.id === parentId) return false;
		if (parentId !== null && isAncestor(program, r.id, parentId)) return false;
	}
	const detached = roots.map((r) => detachStmt(program, r.id)).filter((s): s is Stmt => s != null);
	const block = getBlock(program, parentId, branch);
	if (!block) return false;
	let i = Math.max(0, Math.min(index, block.length));
	for (const s of detached) block.splice(i++, 0, s);
	return true;
}

/** Lista de sentencias que contiene directamente a `id`. */
function blockOf(program: Program, id: string): Stmt[] | null {
	const walk = (body: Stmt[]): Stmt[] | null => {
		if (body.some((s) => s.id === id)) return body;
		for (const s of body) {
			for (const list of childLists(s)) {
				const f = walk(list);
				if (f) return f;
			}
		}
		return null;
	};
	return walk(program.body);
}
