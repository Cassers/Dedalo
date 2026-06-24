import type { Stmt } from '$lib/ir/ast';

export type Shape = 'rect' | 'io' | 'decision' | 'loop';

export interface BlockMeta {
	kind: Stmt['kind'];
	label: string;
	shape: Shape;
	/** clases tailwind de borde/fondo/texto del bloque */
	cls: string;
	/** color del chip de la paleta */
	chip: string;
}

export const BLOCKS: BlockMeta[] = [
	{ kind: 'assign', label: 'Asignar', shape: 'rect', cls: 'border-zinc-500 bg-zinc-800', chip: 'border-zinc-400 text-zinc-700 dark:border-zinc-500 dark:text-zinc-200' },
	{ kind: 'read', label: 'Leer', shape: 'io', cls: 'border-violet-500 bg-violet-900/40', chip: 'border-violet-500 text-violet-700 dark:text-violet-200' },
	{ kind: 'write', label: 'Escribir', shape: 'io', cls: 'border-violet-500 bg-violet-900/40', chip: 'border-violet-500 text-violet-700 dark:text-violet-200' },
	{ kind: 'if', label: 'Si / Sino', shape: 'decision', cls: 'border-amber-500 bg-amber-900/30', chip: 'border-amber-500 text-amber-700 dark:text-amber-200' },
	{ kind: 'while', label: 'Mientras', shape: 'loop', cls: 'border-sky-500 bg-sky-900/30', chip: 'border-sky-500 text-sky-700 dark:text-sky-200' },
	{ kind: 'for', label: 'Para', shape: 'loop', cls: 'border-sky-500 bg-sky-900/30', chip: 'border-sky-500 text-sky-700 dark:text-sky-200' },
	{ kind: 'dowhile', label: 'Repetir', shape: 'loop', cls: 'border-sky-500 bg-sky-900/30', chip: 'border-sky-500 text-sky-700 dark:text-sky-200' }
];

export const META: Record<Stmt['kind'], BlockMeta> = Object.fromEntries(
	BLOCKS.map((b) => [b.kind, b])
) as Record<Stmt['kind'], BlockMeta>;
