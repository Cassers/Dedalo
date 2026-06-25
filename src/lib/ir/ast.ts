/**
 * IR de Dédalo — el AST estructurado que es el hub de TODO.
 *
 * El árbol es "estructurado por construcción": cada sentencia de control contiene
 * a sus hijos (then/else/body). Eso evita el problema de re-estructurar un grafo
 * arbitrario en if/while, y hace que el codegen y el intérprete sean recorridos
 * triviales del árbol. El diagrama DFD se DERIVA de este árbol (no al revés).
 */

export type AbstractType = 'num' | 'text' | 'bool';

// ---------- Expresiones ----------

export type Expr =
	| { kind: 'num'; value: number }
	| { kind: 'str'; value: string }
	| { kind: 'bool'; value: boolean }
	| { kind: 'var'; name: string }
	| { kind: 'bin'; op: BinOp; left: Expr; right: Expr }
	| { kind: 'un'; op: UnOp; expr: Expr }
	| { kind: 'call'; fn: BuiltinFn; args: Expr[] }
	| { kind: 'index'; arr: Expr; index: Expr };

export type BinOp =
	| '+'
	| '-'
	| '*'
	| '/'
	| '%'
	| '=='
	| '!='
	| '<'
	| '<='
	| '>'
	| '>='
	| 'y'
	| 'o';

export type UnOp = '-' | 'no';

/** Funciones integradas comunes en cursos de algoritmia (estilo PSeInt). */
export type BuiltinFn = 'raiz' | 'abs' | 'piso' | 'techo' | 'redondear' | 'longitud' | 'aleatorio';

// ---------- Sentencias ----------

/** Cada nodo lleva un `id` estable para resaltarlo durante la ejecución. */
export interface Node {
	id: string;
}

export type Stmt =
	| Assign
	| Read
	| Write
	| If
	| While
	| DoWhile
	| For
	| CallFn;

export interface Assign extends Node {
	kind: 'assign';
	target: string;
	expr: Expr;
}

export interface Read extends Node {
	kind: 'read';
	vars: string[];
}

export interface Write extends Node {
	kind: 'write';
	exprs: Expr[];
}

/** `flip` (en sentencias con rombo): invierte el lado de las ramas/retorno en el
 * diagrama. Por defecto la rama "Sí" va a la derecha; con flip=true, a la izquierda. */
export interface If extends Node {
	kind: 'if';
	cond: Expr;
	then: Stmt[];
	else: Stmt[];
	flip?: boolean;
}

export interface While extends Node {
	kind: 'while';
	cond: Expr;
	body: Stmt[];
	flip?: boolean;
}

export interface DoWhile extends Node {
	kind: 'dowhile';
	body: Stmt[];
	/** Se repite MIENTRAS la condición sea falsa (semántica "repetir … hasta que"). */
	cond: Expr;
	flip?: boolean;
}

export interface For extends Node {
	kind: 'for';
	var: string;
	from: Expr;
	to: Expr;
	step: Expr;
	body: Stmt[];
	flip?: boolean;
}

/**
 * Llamada a una función guardada por el usuario (bloque custom = "subproceso").
 * No incrusta la definición: referencia por nombre y se resuelve en runtime
 * contra el registro de funciones (codegen/intérprete). `resultVar` opcional
 * captura el valor devuelto.
 */
export interface CallFn extends Node {
	kind: 'callfn';
	fnName: string;
	args: Expr[];
	resultVar?: string;
}

export interface Program {
	/** Nombre de la función (símbolo de Inicio). Por defecto "main". */
	name: string;
	/** Parámetros que recibe la función (se definen en el Inicio). */
	params?: string[];
	/** Variable a devolver al terminar (símbolo de Fin). Si está vacío, no devuelve nada. */
	returnVar?: string;
	body: Stmt[];
}

/** Definición de función disponible como bloque custom (registro en runtime). */
export interface FnDef {
	name: string;
	params: string[];
	returnVar: string | null;
	body: Stmt[];
}

// ---------- Helpers de construcción ----------

let _counter = 0;
/** id único y estable por nodo creado en esta sesión. */
export function newId(prefix = 'n'): string {
	_counter += 1;
	return `${prefix}${_counter}`;
}

export const num = (value: number): Expr => ({ kind: 'num', value });
export const str = (value: string): Expr => ({ kind: 'str', value });
export const bool = (value: boolean): Expr => ({ kind: 'bool', value });
export const v = (name: string): Expr => ({ kind: 'var', name });
export const bin = (op: BinOp, left: Expr, right: Expr): Expr => ({ kind: 'bin', op, left, right });
export const un = (op: UnOp, expr: Expr): Expr => ({ kind: 'un', op, expr });

export const assign = (target: string, expr: Expr): Assign => ({ kind: 'assign', id: newId('a'), target, expr });
export const read = (...vars: string[]): Read => ({ kind: 'read', id: newId('r'), vars });
export const write = (...exprs: Expr[]): Write => ({ kind: 'write', id: newId('w'), exprs });
export const iff = (cond: Expr, then: Stmt[], els: Stmt[] = []): If => ({ kind: 'if', id: newId('if'), cond, then, else: els });
export const whilst = (cond: Expr, body: Stmt[]): While => ({ kind: 'while', id: newId('wh'), cond, body });
export const dowhile = (body: Stmt[], cond: Expr): DoWhile => ({ kind: 'dowhile', id: newId('do'), body, cond });
export const forr = (
	varName: string,
	from: Expr,
	to: Expr,
	body: Stmt[],
	step: Expr = num(1)
): For => ({ kind: 'for', id: newId('for'), var: varName, from, to, step, body });

export const callFn = (fnName: string, args: Expr[] = [], resultVar?: string): CallFn => ({
	kind: 'callfn',
	id: newId('cf'),
	fnName,
	args,
	resultVar
});

/** Crea un bloque de llamada para una función guardada: args = sus parámetros como
 * variables (editable luego), y captura el retorno en una variable si la función devuelve. */
export function createCallFromDef(fn: FnDef): CallFn {
	return callFn(
		fn.name,
		fn.params.map((p) => v(p)),
		fn.returnVar ? 'r' : undefined
	);
}

/** Crea una sentencia por defecto del tipo dado (al soltar un bloque de la paleta). */
export function createStmt(kind: Stmt['kind']): Stmt {
	switch (kind) {
		case 'assign':
			return assign('x', num(0));
		case 'read':
			return read('x');
		case 'write':
			return write(v('x'));
		case 'if':
			return iff(bin('>', v('x'), num(0)), [], []);
		case 'while':
			return whilst(bin('>', v('x'), num(0)), []);
		case 'for':
			return forr('i', num(1), num(10), []);
		case 'dowhile':
			return dowhile([], bin('>', v('x'), num(0)));
		case 'callfn':
			return callFn('', []);
	}
}

/** Clona una sentencia (y sus hijos) con ids nuevos. Las expresiones no llevan id.
 *  Nota: las sentencias pueden venir de un proxy `$state` de Svelte, que NO es
 *  clonable con `structuredClone` (DataCloneError). Las `Expr` son datos puros
 *  JSON-safe, así que el clon vía JSON funciona y evita el proxy. */
export function cloneStmt(s: Stmt): Stmt {
	const e = (x: Expr): Expr => JSON.parse(JSON.stringify(x)) as Expr;
	switch (s.kind) {
		case 'assign':
			return { kind: 'assign', id: newId('a'), target: s.target, expr: e(s.expr) };
		case 'read':
			return { kind: 'read', id: newId('r'), vars: [...s.vars] };
		case 'write':
			return { kind: 'write', id: newId('w'), exprs: s.exprs.map(e) };
		case 'if':
			return { kind: 'if', id: newId('if'), cond: e(s.cond), then: s.then.map(cloneStmt), else: s.else.map(cloneStmt), flip: s.flip };
		case 'while':
			return { kind: 'while', id: newId('wh'), cond: e(s.cond), body: s.body.map(cloneStmt), flip: s.flip };
		case 'dowhile':
			return { kind: 'dowhile', id: newId('do'), body: s.body.map(cloneStmt), cond: e(s.cond), flip: s.flip };
		case 'for':
			return { kind: 'for', id: newId('for'), var: s.var, from: e(s.from), to: e(s.to), step: e(s.step), body: s.body.map(cloneStmt), flip: s.flip };
		case 'callfn':
			return { kind: 'callfn', id: newId('cf'), fnName: s.fnName, args: s.args.map(e), resultVar: s.resultVar };
	}
}

/** Busca un nodo (sentencia) por id en todo el árbol. */
export function findStmt(body: Stmt[], id: string): Stmt | undefined {
	for (const s of body) {
		if (s.id === id) return s;
		const found = childLists(s)
			.map((list) => findStmt(list, id))
			.find(Boolean);
		if (found) return found;
	}
	return undefined;
}

/** Listas de hijos de una sentencia de control (vacío para sentencias simples). */
export function childLists(s: Stmt): Stmt[][] {
	switch (s.kind) {
		case 'if':
			return [s.then, s.else];
		case 'while':
		case 'dowhile':
		case 'for':
			return [s.body];
		default:
			return [];
	}
}
