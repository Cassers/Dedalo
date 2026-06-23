/**
 * Parser de expresiones: texto → Expr. Permite que el alumno escriba expresiones
 * normales ("a + b * 2", "n % 2 == 0", "raiz(x)") en los formularios de edición.
 * Recursivo-descendente con precedencia. Lanza `ParseError` con mensaje claro.
 */
import type { Expr, BinOp, BuiltinFn } from './ast';

export class ParseError extends Error {}

const BUILTINS: BuiltinFn[] = ['raiz', 'abs', 'piso', 'techo', 'redondear', 'longitud', 'aleatorio'];

type Tok =
	| { t: 'num'; v: number }
	| { t: 'str'; v: string }
	| { t: 'id'; v: string }
	| { t: 'op'; v: string }
	| { t: 'punc'; v: string };

function lex(src: string): Tok[] {
	const toks: Tok[] = [];
	let i = 0;
	const isId = (c: string) => /[A-Za-z_À-ſ]/.test(c);
	const isIdN = (c: string) => /[A-Za-z0-9_À-ſ]/.test(c);
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) { i++; continue; }
		if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
			let j = i;
			while (j < src.length && /[0-9.]/.test(src[j])) j++;
			toks.push({ t: 'num', v: Number(src.slice(i, j)) });
			i = j;
			continue;
		}
		if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < src.length && src[j] !== c) j++;
			if (j >= src.length) throw new ParseError('Falta cerrar la comilla');
			toks.push({ t: 'str', v: src.slice(i + 1, j) });
			i = j + 1;
			continue;
		}
		if (isId(c)) {
			let j = i;
			while (j < src.length && isIdN(src[j])) j++;
			toks.push({ t: 'id', v: src.slice(i, j) });
			i = j;
			continue;
		}
		// operadores de dos caracteres
		const two = src.slice(i, i + 2);
		if (['==', '!=', '<=', '>=', '<>'].includes(two)) {
			toks.push({ t: 'op', v: two === '<>' ? '!=' : two });
			i += 2;
			continue;
		}
		if ('+-*/%<>'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
		if ('(),[]'.includes(c)) { toks.push({ t: 'punc', v: c }); i++; continue; }
		if (c === '=') { toks.push({ t: 'op', v: '==' }); i++; continue; } // "=" como igualdad
		throw new ParseError(`Carácter inesperado: "${c}"`);
	}
	return toks;
}

export function parseExpr(src: string): Expr {
	const toks = lex(src);
	let pos = 0;
	const peek = () => toks[pos];
	const eat = () => toks[pos++];
	const expectPunc = (v: string) => {
		const t = eat();
		if (!t || t.t !== 'punc' || t.v !== v) throw new ParseError(`Se esperaba "${v}"`);
	};

	// Mapa palabra/símbolo → operador del AST por nivel.
	const matchKw = (...kw: string[]) => {
		const t = peek();
		if (t && ((t.t === 'op' && kw.includes(t.v)) || (t.t === 'id' && kw.includes(t.v.toLowerCase())))) {
			pos++;
			return t.v.toLowerCase();
		}
		return null;
	};

	function bin(next: () => Expr, ...ops: { kw: string[]; op: BinOp }[]): Expr {
		let left = next();
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const found = ops.find((o) => {
				const save = pos;
				const m = matchKw(...o.kw);
				if (m) return true;
				pos = save;
				return false;
			});
			if (!found) break;
			const right = next();
			left = { kind: 'bin', op: found.op, left, right };
		}
		return left;
	}

	const orE = (): Expr => bin(andE, { kw: ['o'], op: 'o' });
	const andE = (): Expr => bin(eqE, { kw: ['y'], op: 'y' });
	const eqE = (): Expr => bin(relE, { kw: ['=='], op: '==' }, { kw: ['!='], op: '!=' });
	const relE = (): Expr =>
		bin(addE, { kw: ['<'], op: '<' }, { kw: ['<='], op: '<=' }, { kw: ['>'], op: '>' }, { kw: ['>='], op: '>=' });
	const addE = (): Expr => bin(mulE, { kw: ['+'], op: '+' }, { kw: ['-'], op: '-' });
	const mulE = (): Expr => bin(unary, { kw: ['*'], op: '*' }, { kw: ['/'], op: '/' }, { kw: ['%', 'mod'], op: '%' });

	function unary(): Expr {
		const t = peek();
		if (t && t.t === 'op' && t.v === '-') { pos++; return { kind: 'un', op: '-', expr: unary() }; }
		if (t && t.t === 'id' && t.v.toLowerCase() === 'no') { pos++; return { kind: 'un', op: 'no', expr: unary() }; }
		return postfix();
	}

	function postfix(): Expr {
		let e = primary();
		while (peek() && peek().t === 'punc' && peek().v === '[') {
			pos++;
			const idx = orE();
			expectPunc(']');
			e = { kind: 'index', arr: e, index: idx };
		}
		return e;
	}

	function primary(): Expr {
		const t = eat();
		if (!t) throw new ParseError('Expresión incompleta');
		if (t.t === 'num') return { kind: 'num', value: t.v };
		if (t.t === 'str') return { kind: 'str', value: t.v };
		if (t.t === 'punc' && t.v === '(') {
			const e = orE();
			expectPunc(')');
			return e;
		}
		if (t.t === 'id') {
			const low = t.v.toLowerCase();
			if (low === 'verdadero') return { kind: 'bool', value: true };
			if (low === 'falso') return { kind: 'bool', value: false };
			if (peek() && peek().t === 'punc' && peek().v === '(') {
				pos++;
				const args: Expr[] = [];
				if (!(peek() && peek().t === 'punc' && peek().v === ')')) {
					args.push(orE());
					while (peek() && peek().t === 'punc' && peek().v === ',') { pos++; args.push(orE()); }
				}
				expectPunc(')');
				if (!BUILTINS.includes(low as BuiltinFn)) throw new ParseError(`Función desconocida: "${t.v}"`);
				return { kind: 'call', fn: low as BuiltinFn, args };
			}
			return { kind: 'var', name: t.v };
		}
		throw new ParseError(`Token inesperado: "${'v' in t ? t.v : ''}"`);
	}

	const result = orE();
	if (pos < toks.length) throw new ParseError('Sobran símbolos al final de la expresión');
	return result;
}

/** Intenta parsear; devuelve null si falla (para validación en formularios). */
export function tryParseExpr(src: string): { expr?: Expr; error?: string } {
	try {
		return { expr: parseExpr(src) };
	} catch (e) {
		return { error: e instanceof ParseError ? e.message : 'Expresión inválida' };
	}
}
