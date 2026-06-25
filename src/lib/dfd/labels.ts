/** Texto corto (estilo pseudocódigo) para mostrar dentro de cada símbolo DFD. */
import type { Expr, Stmt } from '$lib/ir/ast';

const OP: Record<string, string> = {
	'+': '+', '-': '-', '*': '×', '/': '/', '%': 'mod',
	'==': '=', '!=': '≠', '<': '<', '<=': '≤', '>': '>', '>=': '≥',
	y: 'Y', o: 'O'
};

export function exprText(e: Expr): string {
	switch (e.kind) {
		case 'num':
			return String(e.value);
		case 'str':
			return `"${e.value}"`;
		case 'bool':
			return e.value ? 'Verdadero' : 'Falso';
		case 'var':
			return e.name;
		case 'un':
			return e.op === 'no' ? `NO ${exprText(e.expr)}` : `-${exprText(e.expr)}`;
		case 'bin':
			return `${exprText(e.left)} ${OP[e.op]} ${exprText(e.right)}`;
		case 'call':
			return `${e.fn}(${e.args.map(exprText).join(', ')})`;
		case 'index':
			return `${exprText(e.arr)}[${exprText(e.index)}]`;
	}
}

/** Etiqueta principal de una sentencia para su símbolo. */
export function stmtLabel(s: Stmt): string {
	switch (s.kind) {
		case 'assign':
			return `${s.target} ← ${exprText(s.expr)}`;
		case 'read':
			return `Leer ${s.vars.join(', ')}`;
		case 'write':
			return `Escribir ${s.exprs.map(exprText).join(', ')}`;
		case 'if':
			return `¿${exprText(s.cond)}?`;
		case 'while':
			return `¿${exprText(s.cond)}?`;
		case 'for':
			return `${s.var}: ${exprText(s.from)}..${exprText(s.to)}`;
		case 'dowhile':
			return `¿${exprText(s.cond)}?`;
		case 'callfn': {
			const call = `${s.fnName}(${s.args.map(exprText).join(', ')})`;
			return s.resultVar ? `${s.resultVar} ← ${call}` : call;
		}
	}
}
