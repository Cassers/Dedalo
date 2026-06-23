/**
 * Intérprete de Dédalo — recorre el AST y lo ejecuta en el navegador.
 *
 * Está basado en un generador: cada paso cede un snapshot con el id del nodo
 * activo (para resaltarlo en el diagrama), las variables y la salida acumulada.
 * Eso da el efecto "videojuego": correr todo, o avanzar paso a paso.
 */
import type { Program, Stmt, Expr, BinOp, BuiltinFn } from '$lib/ir/ast';

export type Value = number | string | boolean;

export interface Snapshot {
	/** id del nodo AST que se acaba de ejecutar (para resaltar). */
	nodeId: string;
	/** copia de las variables en este punto. */
	vars: Record<string, Value>;
	/** líneas escritas hasta ahora. */
	output: string[];
}

export class RuntimeError extends Error {}

interface Ctx {
	vars: Map<string, Value>;
	inputs: string[]; // cola de tokens de entrada
	inputPos: number;
	output: string[];
}

/** Convierte el texto de stdin en tokens (números o palabras). */
export function tokenizeInput(raw: string): string[] {
	return raw.split(/\s+/).filter((t) => t.length > 0);
}

function snapshot(ctx: Ctx, nodeId: string): Snapshot {
	return { nodeId, vars: Object.fromEntries(ctx.vars), output: [...ctx.output] };
}

/**
 * Ejecuta el programa. Devuelve un generador: hacé `next()` para avanzar un
 * paso (una sentencia). Cada paso devuelve un Snapshot. Al terminar, `done`.
 */
export function* execute(program: Program, inputRaw = ''): Generator<Snapshot, void, void> {
	_steps = 0;
	const ctx: Ctx = { vars: new Map(), inputs: tokenizeInput(inputRaw), inputPos: 0, output: [] };
	yield* runBlock(program.body, ctx);
}

function* runBlock(body: Stmt[], ctx: Ctx): Generator<Snapshot, void, void> {
	for (const s of body) yield* runStmt(s, ctx);
}

function* runStmt(s: Stmt, ctx: Ctx): Generator<Snapshot, void, void> {
	switch (s.kind) {
		case 'assign':
			ctx.vars.set(s.target, evalExpr(s.expr, ctx));
			yield snapshot(ctx, s.id);
			return;
		case 'read':
			for (const name of s.vars) ctx.vars.set(name, nextInput(ctx, name));
			yield snapshot(ctx, s.id);
			return;
		case 'write':
			ctx.output.push(s.exprs.map((e) => format(evalExpr(e, ctx))).join(' '));
			yield snapshot(ctx, s.id);
			return;
		case 'if':
			yield snapshot(ctx, s.id); // resalta el rombo de decisión
			yield* runBlock(asBool(evalExpr(s.cond, ctx)) ? s.then : s.else, ctx);
			return;
		case 'while':
			// Resalta el nodo del ciclo en cada chequeo de condición.
			while (true) {
				yield snapshot(ctx, s.id);
				if (!asBool(evalExpr(s.cond, ctx))) break;
				yield* runBlock(s.body, ctx);
				guard(ctx);
			}
			return;
		case 'dowhile':
			// Repetir … Hasta Que cond: se repite MIENTRAS cond sea falsa.
			while (true) {
				yield* runBlock(s.body, ctx);
				yield snapshot(ctx, s.id);
				if (asBool(evalExpr(s.cond, ctx))) break;
				guard(ctx);
			}
			return;
		case 'for': {
			let i = asNum(evalExpr(s.from, ctx));
			const to = asNum(evalExpr(s.to, ctx));
			const step = asNum(evalExpr(s.step, ctx)) || 1;
			ctx.vars.set(s.var, i);
			while (step > 0 ? i <= to : i >= to) {
				ctx.vars.set(s.var, i);
				yield snapshot(ctx, s.id);
				yield* runBlock(s.body, ctx);
				i += step;
				guard(ctx);
			}
			return;
		}
	}
}

// Tope de seguridad contra ciclos infinitos en un entorno de juego.
let _steps = 0;
function guard(_ctx: Ctx) {
	_steps += 1;
	if (_steps > 1_000_000) throw new RuntimeError('El algoritmo hizo demasiados pasos (¿ciclo infinito?)');
}

function nextInput(ctx: Ctx, name: string): Value {
	if (ctx.inputPos >= ctx.inputs.length)
		throw new RuntimeError(`Faltan entradas: el algoritmo pidió leer "${name}" pero no hay más datos`);
	const tok = ctx.inputs[ctx.inputPos++];
	const n = Number(tok);
	return tok !== '' && !Number.isNaN(n) ? n : tok;
}

// ---------- Evaluación de expresiones ----------

function evalExpr(e: Expr, ctx: Ctx): Value {
	switch (e.kind) {
		case 'num':
			return e.value;
		case 'str':
			return e.value;
		case 'bool':
			return e.value;
		case 'var': {
			if (!ctx.vars.has(e.name)) throw new RuntimeError(`Variable no definida: "${e.name}"`);
			return ctx.vars.get(e.name)!;
		}
		case 'un':
			return e.op === 'no' ? !asBool(evalExpr(e.expr, ctx)) : -asNum(evalExpr(e.expr, ctx));
		case 'bin':
			return evalBin(e.op, evalExpr(e.left, ctx), evalExpr(e.right, ctx));
		case 'call':
			return evalCall(e.fn, e.args.map((a) => evalExpr(a, ctx)));
		case 'index': {
			const arr = evalExpr(e.arr, ctx);
			const idx = asNum(evalExpr(e.index, ctx));
			if (typeof arr === 'string') return arr[idx] ?? '';
			throw new RuntimeError('Indexación solo soportada sobre texto en el MVP');
		}
	}
}

function evalBin(op: BinOp, l: Value, r: Value): Value {
	switch (op) {
		case '+':
			return typeof l === 'string' || typeof r === 'string' ? format(l) + format(r) : asNum(l) + asNum(r);
		case '-':
			return asNum(l) - asNum(r);
		case '*':
			return asNum(l) * asNum(r);
		case '/':
			return asNum(l) / asNum(r);
		case '%':
			return asNum(l) % asNum(r);
		case '==':
			return l === r;
		case '!=':
			return l !== r;
		case '<':
			return asNum(l) < asNum(r);
		case '<=':
			return asNum(l) <= asNum(r);
		case '>':
			return asNum(l) > asNum(r);
		case '>=':
			return asNum(l) >= asNum(r);
		case 'y':
			return asBool(l) && asBool(r);
		case 'o':
			return asBool(l) || asBool(r);
	}
}

function evalCall(fn: BuiltinFn, args: Value[]): Value {
	const a = (i: number) => asNum(args[i]);
	switch (fn) {
		case 'raiz':
			return Math.sqrt(a(0));
		case 'abs':
			return Math.abs(a(0));
		case 'piso':
			return Math.floor(a(0));
		case 'techo':
			return Math.ceil(a(0));
		case 'redondear':
			return Math.round(a(0));
		case 'longitud':
			return typeof args[0] === 'string' ? args[0].length : 0;
		case 'aleatorio':
			return Math.random();
	}
}

// ---------- Coerciones ----------

function asNum(v: Value): number {
	if (typeof v === 'number') return v;
	if (typeof v === 'boolean') return v ? 1 : 0;
	const n = Number(v);
	if (Number.isNaN(n)) throw new RuntimeError(`No es un número: "${v}"`);
	return n;
}

function asBool(v: Value): boolean {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'number') return v !== 0;
	return v.length > 0;
}

function format(v: Value): string {
	if (typeof v === 'boolean') return v ? 'Verdadero' : 'Falso';
	return String(v);
}

/** Corre el programa hasta el final y devuelve solo la salida (para tests/retos). */
export function runToOutput(program: Program, inputRaw = ''): string[] {
	_steps = 0;
	let last: Snapshot | undefined;
	for (const snap of execute(program, inputRaw)) last = snap;
	return last ? last.output : [];
}
