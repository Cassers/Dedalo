/**
 * Layout de diagrama de flujo estilo PSeInt: AST → geometría (figuras, líneas
 * ortogonales con flechas, etiquetas Sí/No y zonas de drop). Todo se DERIVA del
 * AST. El render (FlowCanvas) sólo dibuja esta geometría en SVG.
 */
import type { Stmt } from '$lib/ir/ast';
import type { Branch } from '$lib/ir/edit';
import { stmtLabel } from './labels';

export type ShapeKind = 'oval' | 'rect' | 'io' | 'decision';

export interface FlowNode {
	id: string;
	stmtId?: string;
	shape: ShapeKind;
	label: string;
	cx: number; // centro X
	y: number; // borde superior
	w: number;
	h: number;
}

export interface FlowEdge {
	id: string;
	d: string; // path SVG (polilínea ortogonal)
	label?: string;
	lx?: number;
	ly?: number;
	arrow?: boolean; // false = sin punta de flecha (puntos de unión)
}

export interface DropZone {
	key: string;
	parentId: string | null;
	branch: Branch;
	index: number;
	cx: number;
	cy: number;
}

export interface FlowGraph {
	nodes: FlowNode[];
	edges: FlowEdge[];
	drops: DropZone[];
	width: number;
	height: number;
}

const NW = 172;
const NH = 46;
const DW = 196;
const DH = 60;
const V = 38; // separación vertical
const H = 34; // separación entre columnas de ramas
const MARGIN = 40;

let _id = 0;
const eid = () => `e${_id++}`;

const poly = (pts: { x: number; y: number }[]) =>
	pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

interface Placed {
	nodes: FlowNode[];
	edges: FlowEdge[];
	drops: DropZone[];
	entry: { x: number; y: number }; // punto de entrada (arriba)
	exit: { x: number; y: number }; // punto de salida (abajo)
	exitLabel?: string;
	bottom: number;
	left: number;
	right: number;
}

// Ancho horizontal que ocupa un bloque (para separar columnas de ramas).
function widthOf(stmts: Stmt[]): number {
	return stmts.reduce((w, s) => Math.max(w, widthStmt(s)), NW);
}
function widthStmt(s: Stmt): number {
	switch (s.kind) {
		case 'if': {
			const elseW = s.else.length ? widthOf(s.else) : NW;
			return Math.max(DW, widthOf(s.then) + H + elseW);
		}
		case 'while':
		case 'for':
		case 'dowhile':
			return Math.max(DW, widthOf(s.body)) + H; // espacio para el back-edge lateral
		default:
			return NW;
	}
}

function placeBlock(stmts: Stmt[], parentId: string | null, branch: Branch, cx: number, top: number): Placed {
	const nodes: FlowNode[] = [];
	const edges: FlowEdge[] = [];
	const drops: DropZone[] = [];
	let y = top;
	let left = cx,
		right = cx;
	let prev: { x: number; y: number; label?: string } | null = null;
	const entry = { x: cx, y: top };

	for (let i = 0; i < stmts.length; i++) {
		const s = stmts[i];
		// zona de drop antes de cada sentencia
		drops.push({ key: `${parentId ?? 'root'}:${branch}:${i}`, parentId, branch, index: i, cx, cy: y - V / 2 });

		const r = placeStmt(s, parentId, branch, cx, y);
		nodes.push(...r.nodes);
		edges.push(...r.edges);
		drops.push(...r.drops);
		left = Math.min(left, r.left);
		right = Math.max(right, r.right);
		if (prev) edges.push(connect(prev, r.entry, prev.label));
		prev = { ...r.exit, label: r.exitLabel };
		y = r.bottom + V;
	}

	// zona de drop al final del bloque
	drops.push({ key: `${parentId ?? 'root'}:${branch}:${stmts.length}`, parentId, branch, index: stmts.length, cx, cy: y - V / 2 });

	if (!prev) {
		// bloque vacío: entrada = salida en el mismo punto
		return { nodes, edges, drops, entry, exit: { x: cx, y: top }, bottom: top, left, right };
	}
	return { nodes, edges, drops, entry, exit: prev, exitLabel: prev.label, bottom: y - V, left, right };
}

// Conector ortogonal entre dos puntos, con flecha (marker en el render).
function connect(from: { x: number; y: number }, to: { x: number; y: number }, label?: string): FlowEdge {
	let pts: { x: number; y: number }[];
	if (from.x === to.x) {
		pts = [from, to];
	} else {
		const midY = (from.y + to.y) / 2;
		pts = [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
	}
	return { id: eid(), d: poly(pts), label, lx: from.x + (to.x - from.x) / 2, ly: from.y + 12 };
}

function node(shape: ShapeKind, s: Stmt, cx: number, y: number, w: number, h: number): FlowNode {
	return { id: `n_${s.id}`, stmtId: s.id, shape, label: stmtLabel(s), cx, y, w, h };
}

function placeStmt(s: Stmt, parentId: string | null, branch: Branch, cx: number, y: number): Placed {
	switch (s.kind) {
		case 'assign':
			return simple(node('rect', s, cx, y, NW, NH));
		case 'read':
		case 'write':
			return simple(node('io', s, cx, y, NW, NH));
		case 'if':
			return placeIf(s, cx, y);
		case 'while':
		case 'for':
			return placeLoop(s, cx, y);
		case 'dowhile':
			return placeDoWhile(s, cx, y);
	}
}

function simple(n: FlowNode): Placed {
	return {
		nodes: [n],
		edges: [],
		drops: [],
		entry: { x: n.cx, y: n.y },
		exit: { x: n.cx, y: n.y + n.h },
		bottom: n.y + n.h,
		left: n.cx - n.w / 2,
		right: n.cx + n.w / 2
	};
}

function placeIf(s: Extract<Stmt, { kind: 'if' }>, cx: number, y: number): Placed {
	const dec = node('decision', s, cx, y, DW, DH);
	const nodes: FlowNode[] = [dec];
	const edges: FlowEdge[] = [];
	const drops: DropZone[] = [];

	// Por defecto "Sí" va a la derecha; con flip=true (por nodo) se invierte.
	const leftIsThen = !!s.flip;
	const leftSt = leftIsThen ? s.then : s.else;
	const rightSt = leftIsThen ? s.else : s.then;
	const leftBr = leftIsThen ? 'then' : 'else';
	const rightBr = leftIsThen ? 'else' : 'then';
	const leftLabel = leftIsThen ? 'Sí' : 'No';
	const rightLabel = leftIsThen ? 'No' : 'Sí';

	const lW = leftSt.length ? widthOf(leftSt) : NW;
	const rW = rightSt.length ? widthOf(rightSt) : NW;
	const total = lW + H + rW;
	const lCx = cx - total / 2 + lW / 2;
	const rCx = cx + total / 2 - rW / 2;
	const branchTop = y + DH + V;

	const lR = placeBlock(leftSt, s.id, leftBr, lCx, branchTop);
	const rR = placeBlock(rightSt, s.id, rightBr, rCx, branchTop);
	nodes.push(...lR.nodes, ...rR.nodes);
	edges.push(...lR.edges, ...rR.edges);
	drops.push(...lR.drops, ...rR.drops);

	const lv = { x: cx - DW / 2, y: y + DH / 2 };
	const rv = { x: cx + DW / 2, y: y + DH / 2 };
	edges.push({ id: eid(), d: poly([lv, { x: lCx, y: lv.y }, { x: lCx, y: lR.entry.y }]), label: leftLabel, lx: lv.x - 6, ly: lv.y - 6 });
	edges.push({ id: eid(), d: poly([rv, { x: rCx, y: rv.y }, { x: rCx, y: rR.entry.y }]), label: rightLabel, lx: rv.x + 6, ly: rv.y - 6 });

	const mergeY = Math.max(lR.bottom, rR.bottom) + V;
	// columnas se reúnen en (cx, mergeY) — sin flecha en la unión
	edges.push({ id: eid(), d: poly([lR.exit, { x: lR.exit.x, y: mergeY }, { x: cx, y: mergeY }]), arrow: false });
	edges.push({ id: eid(), d: poly([rR.exit, { x: rR.exit.x, y: mergeY }, { x: cx, y: mergeY }]), arrow: false });

	return {
		nodes,
		edges,
		drops,
		entry: { x: cx, y },
		exit: { x: cx, y: mergeY },
		bottom: mergeY,
		left: Math.min(lR.left, cx - DW / 2),
		right: Math.max(rR.right, cx + DW / 2)
	};
}

const CLR = 26; // holgura lateral para carriles de líneas

function placeLoop(s: Extract<Stmt, { kind: 'while' | 'for' }>, cx: number, y: number): Placed {
	const dec = node('decision', s, cx, y, DW, DH);
	const bodyTop = y + DH + V;
	const b = placeBlock(s.body, s.id, 'body', cx, bodyTop);

	const decMidY = y + DH / 2;
	const dipY = b.bottom + 16; // baja bajo el cuerpo antes de girar (no lo roza)
	const joinY = dipY + V; // el "No" se reincorpora al flujo aquí
	const noRight = !s.flip; // "No" sale a la derecha por defecto (por nodo)
	const farLeft = Math.min(b.left, cx - DW / 2) - CLR;
	const farRight = Math.max(b.right, cx + DW / 2) + CLR;
	const backX = noRight ? farLeft : farRight; // retorno al lado opuesto del No
	const noX = noRight ? farRight : farLeft;
	const backVx = noRight ? cx - DW / 2 : cx + DW / 2;
	const noVx = noRight ? cx + DW / 2 : cx - DW / 2;

	const edges: FlowEdge[] = [...b.edges];
	// Sí → cuerpo
	edges.push({ id: eid(), d: poly([{ x: cx, y: y + DH }, { x: cx, y: b.entry.y }]), label: 'Sí', lx: cx + 8, ly: y + DH + 10 });
	// back-edge: cuerpo → abajo → lado → arriba → vértice del rombo
	edges.push({ id: eid(), d: poly([b.exit, { x: b.exit.x, y: dipY }, { x: backX, y: dipY }, { x: backX, y: decMidY }, { x: backVx, y: decMidY }]) });
	// No → sale por el lado y baja a reincorporarse (sin flecha en la unión)
	edges.push({ id: eid(), d: poly([{ x: noVx, y: decMidY }, { x: noX, y: decMidY }, { x: noX, y: joinY }, { x: cx, y: joinY }]), label: 'No', lx: noVx + (noRight ? 8 : -8), ly: decMidY - 6, arrow: false });

	return {
		nodes: [dec, ...b.nodes],
		edges,
		drops: b.drops,
		entry: { x: cx, y },
		exit: { x: cx, y: joinY },
		bottom: joinY,
		left: Math.min(backX, noX),
		right: Math.max(backX, noX)
	};
}

function placeDoWhile(s: Extract<Stmt, { kind: 'dowhile' }>, cx: number, y: number): Placed {
	const b = placeBlock(s.body, s.id, 'body', cx, y);
	const dec = node('decision', s, cx, b.bottom + V, DW, DH);
	const decMidY = dec.y + DH / 2;
	const onLeft = !s.flip; // back-edge a la izquierda por defecto (por nodo)
	const backX = onLeft ? Math.min(b.left, cx - DW / 2) - CLR : Math.max(b.right, cx + DW / 2) + CLR;
	const vx = onLeft ? cx - DW / 2 : cx + DW / 2;
	const edges: FlowEdge[] = [...b.edges];
	edges.push(connect(b.exit, { x: cx, y: dec.y }));
	// No (condición falsa) → vuelve al inicio del cuerpo por el costado
	edges.push({
		id: eid(),
		d: poly([{ x: vx, y: decMidY }, { x: backX, y: decMidY }, { x: backX, y: b.entry.y - V / 2 }, { x: cx, y: b.entry.y - V / 2 }, { x: cx, y: b.entry.y }]),
		label: 'No',
		lx: vx + (onLeft ? -8 : 8),
		ly: decMidY - 6
	});
	return {
		nodes: [...b.nodes, dec],
		edges,
		drops: b.drops,
		entry: b.entry,
		exit: { x: cx, y: dec.y + DH },
		exitLabel: 'Sí',
		bottom: dec.y + DH,
		left: Math.min(backX, cx - DW / 2),
		right: Math.max(backX, cx + DW / 2)
	};
}

export function buildFlow(body: Stmt[]): FlowGraph {
	_id = 0;
	const cx = 0;
	const start: FlowNode = { id: 'inicio', shape: 'oval', label: 'Inicio', cx, y: 0, w: 120, h: 40 };
	const block = placeBlock(body, null, 'body', cx, 40 + V);
	const endY = block.bottom + V;
	const end: FlowNode = { id: 'fin', shape: 'oval', label: 'Fin', cx, y: endY, w: 120, h: 40 };

	const edges: FlowEdge[] = [
		connect({ x: cx, y: 40 }, block.entry),
		...block.edges,
		connect(block.exit, { x: cx, y: endY }, block.exitLabel)
	];

	// Normaliza coordenadas (cx=0 → margen) y calcula tamaño total.
	const left = Math.min(block.left, -60) - MARGIN;
	const right = Math.max(block.right, 60) + MARGIN;
	const offX = -left;
	const width = right - left;
	const height = endY + 40 + MARGIN;

	const shift = <T extends { cx?: number; lx?: number; d?: string }>(o: T): T => o;
	void shift;

	const nodes = [start, ...block.nodes, end].map((n) => ({ ...n, cx: n.cx + offX }));
	const drops = block.drops.map((d) => ({ ...d, cx: d.cx + offX }));
	const shiftedEdges = edges.map((e) => ({
		...e,
		d: e.d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${Number(x) + offX} ${y}`),
		lx: e.lx != null ? e.lx + offX : undefined
	}));

	return { nodes, edges: shiftedEdges, drops, width, height };
}
