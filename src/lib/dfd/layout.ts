/**
 * Layout DFD: AST → nodos/edges de Svelte Flow con posiciones calculadas.
 *
 * Las posiciones se DERIVAN del árbol (los nodos no se arrastran libremente):
 * - las sentencias en secuencia se apilan verticalmente en la misma columna,
 * - un `Si` abre dos columnas (ramas Sí/No) que vuelven a unirse en un nodo de
 *   merge,
 * - los ciclos dibujan la condición arriba, el cuerpo debajo y un back-edge.
 *
 * Esquema de handles (puertos) por nodo:
 *   target: 'in' (arriba), 'back' (izquierda)
 *   source: 'out' (abajo), 'alt' (derecha)
 * En un rombo de decisión, 'out' = rama Sí y 'alt' = rama No.
 */
import type { Stmt, Expr } from '$lib/ir/ast';
import { stmtLabel } from './labels';

export const NODE_W = 184;
export const NODE_H = 60;
const V_GAP = 48;
const H_GAP = 48;
const MERGE = 22;

export type DfdNodeType = 'terminal' | 'process' | 'io' | 'decision' | 'merge';

export interface DfdNode {
	id: string;
	type: DfdNodeType;
	position: { x: number; y: number };
	data: { label: string; stmtId?: string; variant?: 'inicio' | 'fin' };
	width?: number;
	height?: number;
	draggable: boolean;
	selectable: boolean;
}

export interface DfdEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle: string;
	targetHandle: string;
	label?: string;
	type: 'smoothstep';
	data: { stmtId?: string };
}

interface Exit {
	id: string;
	handle: string; // 'out' | 'alt'
	label?: string;
}
interface Placed {
	nodes: DfdNode[];
	edges: DfdEdge[];
	entry: string;
	exit: Exit;
	bottom: number; // y más bajo ocupado
}

let _e = 0;
const edge = (
	source: string,
	sourceHandle: string,
	target: string,
	targetHandle: string,
	label?: string,
	stmtId?: string
): DfdEdge => ({
	id: `e${_e++}`,
	source,
	sourceHandle,
	target,
	targetHandle,
	label,
	type: 'smoothstep',
	data: { stmtId }
});

const at = (x: number, y: number) => ({ x: Math.round(x - NODE_W / 2), y: Math.round(y) });

// ---------- Ancho horizontal que ocupa un bloque ----------

function widthOf(stmts: Stmt[]): number {
	return stmts.reduce((w, s) => Math.max(w, widthStmt(s)), NODE_W);
}
function widthStmt(s: Stmt): number {
	switch (s.kind) {
		case 'if': {
			const elseW = s.else.length ? widthOf(s.else) : NODE_W;
			return Math.max(NODE_W, widthOf(s.then) + H_GAP + elseW);
		}
		case 'while':
		case 'for':
		case 'dowhile':
			return Math.max(NODE_W, widthOf(s.body) + H_GAP); // +gap por el back-edge lateral
		default:
			return NODE_W;
	}
}

// ---------- Colocación ----------

let _idCounter = 0;
const genId = (p: string) => `${p}_${_idCounter++}`;

/** Coloca una secuencia de sentencias centradas en `cx`, empezando en `top`. */
export function placeBlock(stmts: Stmt[], cx: number, top: number): Placed {
	const nodes: DfdNode[] = [];
	const edges: DfdEdge[] = [];
	let y = top;
	let entry = '';
	let prevExit: Exit | null = null;

	for (const s of stmts) {
		const r = placeStmt(s, cx, y);
		nodes.push(...r.nodes);
		edges.push(...r.edges);
		if (!entry) entry = r.entry;
		if (prevExit) edges.push(edge(prevExit.id, prevExit.handle, r.entry, 'in', prevExit.label));
		prevExit = r.exit;
		y = r.bottom + V_GAP;
	}

	if (!prevExit) {
		// Bloque vacío: un nodo de paso invisible-ish (merge) para tener entrada/salida.
		const id = genId('empty');
		nodes.push({ id, type: 'merge', position: at(cx, top), data: { label: '' }, width: MERGE, height: MERGE, draggable: false, selectable: false });
		return { nodes, edges, entry: id, exit: { id, handle: 'out' }, bottom: top + MERGE };
	}
	return { nodes, edges, entry, exit: prevExit, bottom: y - V_GAP };
}

function simpleNode(type: DfdNodeType, s: Stmt, cx: number, y: number): Placed {
	const id = genId(s.kind);
	const node: DfdNode = {
		id,
		type,
		position: at(cx, y),
		data: { label: stmtLabel(s), stmtId: s.id },
		width: NODE_W,
		height: NODE_H,
		draggable: false,
		selectable: true
	};
	return { nodes: [node], edges: [], entry: id, exit: { id, handle: 'out' }, bottom: y + NODE_H };
}

function placeStmt(s: Stmt, cx: number, y: number): Placed {
	switch (s.kind) {
		case 'assign':
			return simpleNode('process', s, cx, y);
		case 'read':
		case 'write':
			return simpleNode('io', s, cx, y);
		case 'if':
			return placeIf(s, cx, y);
		case 'while':
		case 'for':
			return placeLoop(s, cx, y);
		case 'dowhile':
			return placeDoWhile(s, cx, y);
	}
}

function decisionNode(s: Stmt, cx: number, y: number): DfdNode {
	return {
		id: genId(s.kind),
		type: 'decision',
		position: at(cx, y),
		data: { label: stmtLabel(s), stmtId: s.id },
		width: NODE_W,
		height: NODE_H,
		draggable: false,
		selectable: true
	};
}

function placeIf(s: Extract<Stmt, { kind: 'if' }>, cx: number, y: number): Placed {
	const dec = decisionNode(s, cx, y);
	const nodes: DfdNode[] = [dec];
	const edges: DfdEdge[] = [];

	const thenW = widthOf(s.then);
	const elseW = s.else.length ? widthOf(s.else) : NODE_W;
	const total = thenW + H_GAP + elseW;
	const thenCx = cx - total / 2 + thenW / 2;
	const elseCx = cx + total / 2 - elseW / 2;
	const branchTop = y + NODE_H + V_GAP;

	const thenR = placeBlock(s.then, thenCx, branchTop);
	nodes.push(...thenR.nodes);
	edges.push(...thenR.edges, edge(dec.id, 'out', thenR.entry, 'in', 'Sí', s.id));

	let branchesBottom = thenR.bottom;
	let elseExit: Exit | null = null;
	let elseR: Placed | null = null;
	if (s.else.length) {
		elseR = placeBlock(s.else, elseCx, branchTop);
		nodes.push(...elseR.nodes);
		edges.push(...elseR.edges, edge(dec.id, 'alt', elseR.entry, 'in', 'No', s.id));
		branchesBottom = Math.max(branchesBottom, elseR.bottom);
		elseExit = elseR.exit;
	}

	// Nodo de merge donde se reúnen las ramas.
	const mergeId = genId('merge');
	const mergeY = branchesBottom + V_GAP;
	nodes.push({ id: mergeId, type: 'merge', position: at(cx, mergeY), data: { label: '' }, width: MERGE, height: MERGE, draggable: false, selectable: false });
	edges.push(edge(thenR.exit.id, thenR.exit.handle, mergeId, 'in'));
	if (elseExit) edges.push(edge(elseExit.id, elseExit.handle, mergeId, 'in'));
	else edges.push(edge(dec.id, 'alt', mergeId, 'in', 'No'));

	return { nodes, edges, entry: dec.id, exit: { id: mergeId, handle: 'out' }, bottom: mergeY + MERGE };
}

function placeLoop(s: Extract<Stmt, { kind: 'while' | 'for' }>, cx: number, y: number): Placed {
	const dec = decisionNode(s, cx, y);
	const bodyTop = y + NODE_H + V_GAP;
	const bodyR = placeBlock(s.body, cx, bodyTop);

	const edges: DfdEdge[] = [
		...bodyR.edges,
		edge(dec.id, 'out', bodyR.entry, 'in', 'Sí', s.id), // condición verdadera → cuerpo
		edge(bodyR.exit.id, bodyR.exit.handle, dec.id, 'back', '', s.id) // back-edge cuerpo → condición
	];
	// La salida del ciclo continúa por la rama "No" (handle 'alt').
	return {
		nodes: [dec, ...bodyR.nodes],
		edges,
		entry: dec.id,
		exit: { id: dec.id, handle: 'alt', label: 'No' },
		bottom: bodyR.bottom
	};
}

function placeDoWhile(s: Extract<Stmt, { kind: 'dowhile' }>, cx: number, y: number): Placed {
	const bodyR = placeBlock(s.body, cx, y);
	const dec = decisionNode(s, cx, bodyR.bottom + V_GAP);

	const edges: DfdEdge[] = [
		...bodyR.edges,
		edge(bodyR.exit.id, bodyR.exit.handle, dec.id, 'in'),
		// Repetir … Hasta Que: si la condición es FALSA, vuelve al inicio del cuerpo.
		edge(dec.id, 'alt', bodyR.entry, 'back', 'No', s.id)
	];
	return {
		nodes: [...bodyR.nodes, dec],
		edges,
		entry: bodyR.entry,
		exit: { id: dec.id, handle: 'out', label: 'Sí' }, // condición verdadera → sale
		bottom: dec.position.y + NODE_H
	};
}

// ---------- Punto de entrada: programa completo ----------

export interface DfdGraph {
	nodes: DfdNode[];
	edges: DfdEdge[];
}

export function buildGraph(body: Stmt[]): DfdGraph {
	_e = 0;
	_idCounter = 0;
	const cx = 0;
	const startId = 'inicio';
	const start: DfdNode = { id: startId, type: 'terminal', position: at(cx, 0), data: { label: 'Inicio', variant: 'inicio' }, width: NODE_W, height: NODE_H, draggable: false, selectable: false };

	const block = placeBlock(body, cx, NODE_H + V_GAP);
	const endY = block.bottom + V_GAP;
	const endId = 'fin';
	const end: DfdNode = { id: endId, type: 'terminal', position: at(cx, endY), data: { label: 'Fin', variant: 'fin' }, width: NODE_W, height: NODE_H, draggable: false, selectable: false };

	const edges: DfdEdge[] = [
		edge(startId, 'out', block.entry, 'in'),
		...block.edges,
		edge(block.exit.id, block.exit.handle, endId, 'in', block.exit.label)
	];

	return { nodes: [start, ...block.nodes, end], edges };
}

// Reexport para etiquetas en otros módulos.
export type { Expr };
