/**
 * Codegen: DFD (AST) → código nativo. Un recorrido del árbol por lenguaje.
 *
 * El AST es estructurado, así que generar código es imprimir el árbol con la
 * sintaxis de cada dialecto. MVP: pseudocódigo (español), Python y JavaScript.
 * Para sumar un lenguaje tipado (C/Java) basta otro `Dialect` + manejo de tipos.
 */
import type { Program, Stmt, Expr, BinOp, UnOp, BuiltinFn, FnDef } from '$lib/ir/ast';
import { childLists } from '$lib/ir/ast';

export type TargetLang = 'pseudo' | 'python' | 'javascript';

export interface LangMeta {
	key: TargetLang;
	label: string;
	/** clave de resaltado para CodeMirror */
	cm: 'python' | 'javascript';
}

export const TARGETS: LangMeta[] = [
	{ key: 'pseudo', label: 'Pseudocódigo', cm: 'python' },
	{ key: 'python', label: 'Python 3', cm: 'python' },
	{ key: 'javascript', label: 'JavaScript', cm: 'javascript' }
];

/** Cómo cada dialecto renderiza operadores, funciones y construcciones. */
interface Dialect {
	indent: string;
	binOp: Record<BinOp, string>;
	unOp: Record<UnOp, string>;
	fn: Record<BuiltinFn, string>;
	boolLit: (b: boolean) => string;
	// Sentencias (reciben strings ya renderizados de sus expresiones).
	assign: (target: string, expr: string) => string[];
	read: (vars: string[]) => string[];
	write: (exprs: string[]) => string[];
	// Bloques de control: devuelven cabecera y cierre; el cuerpo se indenta.
	ifOpen: (cond: string) => string;
	elseLine: string | null; // null => Python/JS usan ramas separadas (ver abajo)
	ifClose: string | null;
	whileOpen: (cond: string) => string;
	whileClose: string | null;
	forOpen: (varName: string, from: string, to: string, step: string) => string;
	forClose: string | null;
	// Firma de la función (Inicio) y retorno (Fin).
	funcOpen: (name: string, params: string[]) => string;
	funcClose: string | null;
	ret: (varName: string) => string;
	// Llamada a una función guardada (bloque custom). resultVar opcional.
	callfn: (resultVar: string | undefined, fnName: string, args: string[]) => string[];
}

// ---------- Render de expresiones ----------

function emitExpr(e: Expr, d: Dialect): string {
	switch (e.kind) {
		case 'num':
			return String(e.value);
		case 'str':
			return JSON.stringify(e.value);
		case 'bool':
			return d.boolLit(e.value);
		case 'var':
			return e.name;
		case 'un':
			return e.op === 'no'
				? `${d.unOp.no}(${emitExpr(e.expr, d)})`
				: `${d.unOp['-']}${emitExpr(e.expr, d)}`;
		case 'bin':
			return `(${emitExpr(e.left, d)} ${d.binOp[e.op]} ${emitExpr(e.right, d)})`;
		case 'call':
			return `${d.fn[e.fn]}(${e.args.map((a) => emitExpr(a, d)).join(', ')})`;
		case 'index':
			return `${emitExpr(e.arr, d)}[${emitExpr(e.index, d)}]`;
	}
}

// ---------- Recorrido de sentencias ----------

// Cada emisión es relativa a su nivel 0; la indentación se agrega al anidar.
function emitStmts(body: Stmt[], d: Dialect): string[] {
	return body.flatMap((s) => emitStmt(s, d));
}

function indentLines(lines: string[], d: Dialect, depth: number): string[] {
	const pad = d.indent.repeat(depth);
	return lines.map((l) => (l === '' ? '' : pad + l));
}

function emitStmt(s: Stmt, d: Dialect): string[] {
	switch (s.kind) {
		case 'assign':
			return d.assign(s.target, emitExpr(s.expr, d));
		case 'read':
			return d.read(s.vars);
		case 'write':
			return d.write(s.exprs.map((x) => emitExpr(x, d)));
		case 'if': {
			const lines = [d.ifOpen(emitExpr(s.cond, d))];
			lines.push(...indentLines(emitStmts(s.then, d), d, 1));
			if (s.else.length) {
				// Python/JS: la rama else va al mismo nivel que el if.
				lines.push(d.elseLine ?? 'else:');
				lines.push(...indentLines(emitStmts(s.else, d), d, 1));
			}
			if (d.ifClose) lines.push(d.ifClose);
			return lines;
		}
		case 'while': {
			const lines = [d.whileOpen(emitExpr(s.cond, d))];
			lines.push(...indentLines(emitStmts(s.body, d), d, 1));
			if (d.whileClose) lines.push(d.whileClose);
			return lines;
		}
		case 'callfn':
			return d.callfn(s.resultVar, s.fnName, s.args.map((a) => emitExpr(a, d)));
		case 'dowhile':
			return emitDoWhile(s.body, emitExpr(s.cond, d), d);
		case 'for': {
			const lines = [
				d.forOpen(s.var, emitExpr(s.from, d), emitExpr(s.to, d), emitExpr(s.step, d))
			];
			lines.push(...indentLines(emitStmts(s.body, d), d, 1));
			if (d.forClose) lines.push(d.forClose);
			return lines;
		}
	}
}

// do-while difiere demasiado entre dialectos → manejo dedicado.
function emitDoWhile(body: Stmt[], cond: string, d: Dialect): string[] {
	if (d === pseudo) {
		// Repetir … Hasta Que <cond>  (se repite mientras cond sea FALSA)
		return ['Repetir', ...indentLines(emitStmts(body, d), d, 1), `Hasta Que ${cond}`];
	}
	// Python/JS: while True { … if (cond) break }
	if (d === python) {
		return [
			'while True:',
			...indentLines(emitStmts(body, d), d, 1),
			d.indent + `if ${cond}:`,
			d.indent.repeat(2) + 'break'
		];
	}
	return [
		'do {',
		...indentLines(emitStmts(body, d), d, 1),
		`} while (!(${cond}));`
	];
}

// ---------- Dialectos ----------

const pseudo: Dialect = {
	indent: '    ',
	binOp: {
		'+': '+', '-': '-', '*': '*', '/': '/', '%': 'MOD',
		'==': '=', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
		y: 'Y', o: 'O'
	},
	unOp: { '-': '-', no: 'NO ' },
	fn: { raiz: 'rc', abs: 'abs', piso: 'trunc', techo: 'techo', redondear: 'redon', longitud: 'longitud', aleatorio: 'azar' },
	boolLit: (b) => (b ? 'Verdadero' : 'Falso'),
	assign: (t, e) => [`${t} <- ${e}`],
	read: (vars) => [`Leer ${vars.join(', ')}`],
	write: (exprs) => [`Escribir ${exprs.join(', ')}`],
	ifOpen: (c) => `Si ${c} Entonces`,
	elseLine: 'Sino',
	ifClose: 'FinSi',
	whileOpen: (c) => `Mientras ${c} Hacer`,
	whileClose: 'FinMientras',
	forOpen: (varName, from, to, step) =>
		`Para ${varName} <- ${from} Hasta ${to} Con Paso ${step} Hacer`,
	forClose: 'FinPara',
	funcOpen: (name, params) => `Funcion ${name}(${params.join(', ')})`,
	funcClose: 'FinFuncion',
	ret: (vn) => `Retornar ${vn}`,
	callfn: (rv, fn, args) => [`${rv ? `${rv} <- ` : ''}${fn}(${args.join(', ')})`]
};

const python: Dialect = {
	indent: '    ',
	binOp: {
		'+': '+', '-': '-', '*': '*', '/': '/', '%': '%',
		'==': '==', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
		y: 'and', o: 'or'
	},
	unOp: { '-': '-', no: 'not ' },
	fn: { raiz: 'math.sqrt', abs: 'abs', piso: 'math.floor', techo: 'math.ceil', redondear: 'round', longitud: 'len', aleatorio: 'random.random' },
	boolLit: (b) => (b ? 'True' : 'False'),
	assign: (t, e) => [`${t} = ${e}`],
	read: (vars) => vars.map((vn) => `${vn} = int(input())`),
	write: (exprs) => [`print(${exprs.join(', ')})`],
	ifOpen: (c) => `if ${c}:`,
	elseLine: 'else:',
	ifClose: null,
	whileOpen: (c) => `while ${c}:`,
	whileClose: null,
	forOpen: (varName, from, to, step) => `for ${varName} in range(${from}, (${to}) + 1, ${step}):`,
	forClose: null,
	funcOpen: (name, params) => `def ${name}(${params.join(', ')}):`,
	funcClose: null,
	ret: (vn) => `return ${vn}`,
	callfn: (rv, fn, args) => [`${rv ? `${rv} = ` : ''}${fn}(${args.join(', ')})`]
};

const javascript: Dialect = {
	indent: '  ',
	binOp: {
		'+': '+', '-': '-', '*': '*', '/': '/', '%': '%',
		'==': '===', '!=': '!==', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
		y: '&&', o: '||'
	},
	unOp: { '-': '-', no: '!' },
	fn: { raiz: 'Math.sqrt', abs: 'Math.abs', piso: 'Math.floor', techo: 'Math.ceil', redondear: 'Math.round', longitud: 'len', aleatorio: 'Math.random' },
	boolLit: (b) => (b ? 'true' : 'false'),
	assign: (t, e) => [`let ${t} = ${e};`],
	read: (vars) => vars.map((vn) => `let ${vn} = Number(leer());`),
	write: (exprs) => [`console.log(${exprs.join(', ')});`],
	ifOpen: (c) => `if (${c}) {`,
	elseLine: '} else {',
	ifClose: '}',
	whileOpen: (c) => `while (${c}) {`,
	whileClose: '}',
	forOpen: (varName, from, to, step) =>
		`for (let ${varName} = ${from}; ${varName} <= ${to}; ${varName} += ${step}) {`,
	forClose: '}',
	funcOpen: (name, params) => `function ${name}(${params.join(', ')}) {`,
	funcClose: '}',
	ret: (vn) => `return ${vn};`,
	callfn: (rv, fn, args) => [`${rv ? `let ${rv} = ` : ''}${fn}(${args.join(', ')});`]
};

const DIALECTS: Record<TargetLang, Dialect> = { pseudo, python, javascript };

/** Nombres de funciones usadas (recursivo, post-orden → dependencias primero). */
function collectUsedFns(body: Stmt[], byName: Map<string, FnDef>, seen: Set<string>, out: string[]) {
	for (const s of body) {
		if (s.kind === 'callfn') {
			if (!seen.has(s.fnName)) {
				seen.add(s.fnName);
				const def = byName.get(s.fnName);
				if (def) {
					collectUsedFns(def.body, byName, seen, out); // deps de la función primero
					out.push(s.fnName);
				}
			}
		}
		for (const list of childLists(s)) collectUsedFns(list, byName, seen, out);
	}
}

/** Encabezados (imports / helpers) que el código necesita. */
function header(lang: TargetLang, all: string): string[] {
	if (lang === 'python') {
		const lines: string[] = [];
		if (all.includes('math.')) lines.push('import math');
		if (all.includes('random.')) lines.push('import random');
		return lines.length ? [...lines, ''] : [];
	}
	if (lang === 'javascript') {
		const lines: string[] = [];
		// `leer()` es un stub para entradas; en Dédalo la ejecución real corre el AST.
		if (all.includes('leer(')) lines.push('// leer(): provee la siguiente entrada (lo maneja el motor de Dédalo)');
		if (all.includes('len(')) lines.push('const len = (a) => a.length;');
		return lines.length ? [...lines, ''] : [];
	}
	return [];
}

/** Envuelve un cuerpo en una firma de función + retorno opcional. */
function emitFunction(d: Dialect, name: string, params: string[], body: Stmt[], returnVar?: string | null): string[] {
	const inner = emitStmts(body, d);
	if (returnVar) inner.push(d.ret(returnVar));
	return [d.funcOpen(name, params), ...indentLines(inner, d, 1), ...(d.funcClose ? [d.funcClose] : [])];
}

/** Punto de entrada: AST → string de código. `fns` = funciones guardadas (bloques custom). */
export function generate(lang: TargetLang, program: Program, fns: FnDef[] = []): string {
	const d = DIALECTS[lang];
	const name = program.name || 'main';
	const params = program.params ?? [];
	const byName = new Map(fns.map((f) => [f.name, f]));

	// Definiciones de las funciones usadas (recursivo, dependencias primero).
	const usedNames: string[] = [];
	collectUsedFns(program.body, byName, new Set(), usedNames);
	const defs: string[] = [];
	for (const fnName of usedNames) {
		const f = byName.get(fnName);
		if (!f) continue;
		defs.push(...emitFunction(d, f.name, f.params, f.body, f.returnVar), '');
	}

	const main = emitFunction(d, name, params, program.body, program.returnVar);

	// El header detecta imports/helpers sobre TODO el código (programa + funciones usadas).
	const all = JSON.stringify(program) + usedNames.map((n) => JSON.stringify(byName.get(n))).join('');
	const lines = [...header(lang, all), ...defs, ...main];
	return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
