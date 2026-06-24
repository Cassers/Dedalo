<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { createStmt, cloneStmt } from '$lib/ir/ast';
	import { buildFlow, type FlowNode } from '$lib/dfd/flowlayout';
	import { insertAt, moveTo, moveGroup, removeStmt, findStmt, selectionRoots, locateFull } from '$lib/ir/edit';
	import { activeStmtId, selection, selectOnly, toggleSelect, clearSelection } from '$lib/dfd/active';
	import { dragging, clipboard } from '$lib/dnd';
	import { isDark } from '$lib/theme';
	import { get } from 'svelte/store';
	import NodeEditor from './NodeEditor.svelte';

	let { program, onchange }: { program: Program; onchange: () => void } = $props();

	const flow = $derived(buildFlow(program.body));
	const NW = 172;
	let canvasEl: HTMLDivElement;

	let overKey = $state<string | null>(null);
	let marq = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

	const movingId = $derived($dragging?.type === 'move' ? $dragging.id : null);

	function shapePoints(n: FlowNode): string {
		const x = n.cx - n.w / 2;
		if (n.shape === 'io') {
			const s = 12;
			return `${x + s},${n.y} ${x + n.w},${n.y} ${x + n.w - s},${n.y + n.h} ${x},${n.y + n.h}`;
		}
		return `${n.cx},${n.y} ${x + n.w},${n.y + n.h / 2} ${n.cx},${n.y + n.h} ${x},${n.y + n.h / 2}`;
	}
	function fillFor(n: FlowNode) {
		const d = $isDark;
		if (n.shape === 'oval') return n.label === 'Fin' ? (d ? '#4c0519' : '#ffe4e6') : d ? '#052e16' : '#dcfce7';
		if (n.shape === 'io') return d ? 'rgba(124,58,237,0.28)' : '#ede9fe';
		if (n.shape === 'decision') return d ? 'rgba(180,83,9,0.28)' : '#fef3c7';
		return d ? '#27272a' : '#f4f4f5';
	}
	function strokeFor(n: FlowNode) {
		if (n.shape === 'oval') return n.label === 'Fin' ? '#e11d48' : '#10b981';
		if (n.shape === 'io') return '#8b5cf6';
		if (n.shape === 'decision') return '#f59e0b';
		return $isDark ? '#71717a' : '#a1a1aa';
	}
	const edgeColor = $derived($isDark ? '#71717a' : '#a1a1aa');
	const textColor = $derived($isDark ? '#e4e4e7' : '#27272a');
	const trunc = (s: string) => (s.length > 26 ? s.slice(0, 25) + '…' : s);

	// ---------- drag-and-drop (insertar / mover) ----------
	function allow(e: DragEvent, key: string) {
		if (!$dragging) return;
		e.preventDefault();
		overKey = key;
		if (e.dataTransfer) e.dataTransfer.dropEffect = $dragging.type === 'new' ? 'copy' : 'move';
	}
	function drop(e: DragEvent, d: (typeof flow.drops)[number]) {
		e.preventDefault();
		overKey = null;
		const p = $dragging;
		if (!p) return;
		if (p.type === 'new') {
			insertAt(program, d.parentId, d.branch, d.index, createStmt(p.kind));
		} else if ($selection.has(p.id) && $selection.size > 1) {
			moveGroup(program, $selection, d.parentId, d.branch, d.index); // mover grupo
		} else {
			moveTo(program, p.id, d.parentId, d.branch, d.index);
		}
		dragging.set(null);
		onchange();
	}
	function startMove(e: DragEvent, n: FlowNode) {
		if (!n.stmtId) return;
		if (!$selection.has(n.stmtId)) selectOnly(n.stmtId);
		dragging.set({ type: 'move', id: n.stmtId });
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', n.stmtId);
			e.dataTransfer.effectAllowed = 'move';
			const many = $selection.size > 1 && $selection.has(n.stmtId);
			const ghost = document.createElement('div');
			ghost.textContent = many ? `${$selection.size} bloques` : n.label;
			ghost.style.cssText =
				`position:fixed;top:-1000px;left:-1000px;padding:6px 12px;border:2px solid ${strokeFor(n)};` +
				`background:#18181b;color:#e4e4e7;border-radius:8px;white-space:nowrap;` +
				`font:600 12px ui-monospace,monospace;box-shadow:0 6px 20px rgba(0,0,0,.5);`;
			document.body.appendChild(ghost);
			e.dataTransfer.setDragImage(ghost, 14, 14);
			setTimeout(() => ghost.remove(), 0);
		}
	}

	// ---------- selección por clic / marco ----------
	function clickNode(e: MouseEvent, id: string) {
		if (e.ctrlKey || e.metaKey || e.shiftKey) toggleSelect(id);
		else selectOnly(id);
	}
	function localPt(e: PointerEvent) {
		const r = canvasEl.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}
	function bgDown(e: PointerEvent) {
		if (e.button !== 0) return;
		// No iniciar marco si el clic fue sobre un bloque o un panel flotante.
		if ((e.target as HTMLElement).closest('[data-node],[data-panel]')) return;
		const p = localPt(e);
		marq = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
	}
	function winMove(e: PointerEvent) {
		if (!marq) return;
		const p = localPt(e);
		marq = { ...marq, x1: p.x, y1: p.y };
		const r = marqRect();
		const ids = new Set<string>();
		for (const n of flow.nodes) {
			if (!n.stmtId) continue;
			if (rectsHit(r, { x: n.cx - n.w / 2, y: n.y, w: n.w, h: n.h })) ids.add(n.stmtId);
		}
		selection.set(ids);
	}
	function winUp() {
		if (!marq) return;
		const r = marqRect();
		if (r.w < 4 && r.h < 4) clearSelection(); // clic en vacío = deseleccionar
		marq = null;
	}
	function marqRect() {
		const m = marq!;
		return { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
	}
	function rectsHit(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
		return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
	}

	// ---------- copiar / pegar / borrar ----------
	function copy() {
		const roots = selectionRoots(program, get(selection));
		if (roots.length) clipboard.set(roots.map(cloneStmt));
	}
	/** Inserta una lista de bloques después de la selección (o al final). */
	function insertAfterSelection(items: typeof program.body) {
		if (!items.length) return;
		const clones = items.map(cloneStmt);
		const roots = selectionRoots(program, get(selection));
		let parentId: string | null = null;
		let branch: 'then' | 'else' | 'body' = 'body';
		let index = program.body.length;
		if (roots.length) {
			const loc = locateFull(program, roots[roots.length - 1].id);
			if (loc) {
				parentId = loc.parentId;
				branch = loc.branch;
				index = loc.index + 1;
			}
		}
		let i = index;
		for (const c of clones) insertAt(program, parentId, branch, i++, c);
		selection.set(new Set(clones.map((c) => c.id)));
		onchange();
	}
	function paste() {
		insertAfterSelection(get(clipboard)); // get(): valor actual, sin depender de la suscripción
	}
	function duplicate() {
		insertAfterSelection(selectionRoots(program, get(selection))); // directo, sin portapapeles
	}
	function deleteSel() {
		const roots = selectionRoots(program, get(selection));
		if (!roots.length) return;
		for (const r of roots) removeStmt(program.body, r.id);
		clearSelection();
		onchange();
	}
	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
		if (typing) return;
		const mod = e.ctrlKey || e.metaKey;
		if (mod && e.key.toLowerCase() === 'c') { copy(); e.preventDefault(); }
		else if (mod && e.key.toLowerCase() === 'v') { paste(); e.preventDefault(); }
		else if (mod && e.key.toLowerCase() === 'x') { copy(); deleteSel(); e.preventDefault(); }
		else if (e.key === 'Delete' || e.key === 'Backspace') { deleteSel(); e.preventDefault(); }
		else if (e.key === 'Escape') clearSelection();
	}

	const single = $derived($selection.size === 1 ? findStmt(program.body, [...$selection][0]) : undefined);
	function del(id: string) {
		removeStmt(program.body, id);
		clearSelection();
		onchange();
	}
</script>

<svelte:window onpointermove={winMove} onpointerup={winUp} onkeydown={onKey} />

<div class="relative h-full w-full overflow-auto" onpointerdown={bgDown} role="presentation">
	<div bind:this={canvasEl} class="relative mx-auto select-none" style="width:{flow.width}px; height:{flow.height}px">
		<!-- SVG: figuras + líneas -->
		<svg class="absolute inset-0 pointer-events-none" width={flow.width} height={flow.height}>
			<defs>
				<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" fill={edgeColor} />
				</marker>
			</defs>
			{#each flow.edges as e (e.id)}
				<path d={e.d} fill="none" stroke={edgeColor} stroke-width="1.6" marker-end={e.arrow === false ? undefined : 'url(#arrow)'} />
				{#if e.label}
					<text x={e.lx} y={e.ly} fill={textColor} font-size="11" font-weight="600" text-anchor="middle">{e.label}</text>
				{/if}
			{/each}
			{#each flow.nodes as n (n.id)}
				{@const active = n.stmtId && $activeStmtId === n.stmtId}
				{@const selected = n.stmtId && $selection.has(n.stmtId)}
				{@const moving = n.stmtId && movingId === n.stmtId}
				{@const stroke = active ? '#fbbf24' : selected ? '#38bdf8' : strokeFor(n)}
				<g opacity={moving ? 0.35 : 1} style={active ? 'filter:drop-shadow(0 0 6px rgba(251,191,36,0.7))' : selected ? 'filter:drop-shadow(0 0 5px rgba(56,189,248,0.6))' : ''}>
					{#if n.shape === 'oval'}
						<rect x={n.cx - n.w / 2} y={n.y} width={n.w} height={n.h} rx={n.h / 2} ry={n.h / 2} fill={fillFor(n)} {stroke} stroke-width={selected ? 3 : 2} stroke-dasharray={moving ? '5 4' : undefined} />
					{:else if n.shape === 'rect'}
						<rect x={n.cx - n.w / 2} y={n.y} width={n.w} height={n.h} rx="6" fill={fillFor(n)} {stroke} stroke-width={selected ? 3 : 2} stroke-dasharray={moving ? '5 4' : undefined} />
					{:else}
						<polygon points={shapePoints(n)} fill={fillFor(n)} {stroke} stroke-width={selected ? 3 : 2} stroke-dasharray={moving ? '5 4' : undefined} />
					{/if}
					<text x={n.cx} y={n.y + n.h / 2 + 4} fill={textColor} font-size="12.5" text-anchor="middle" font-family="ui-monospace,monospace">{trunc(n.label)}</text>
				</g>
			{/each}
		</svg>

		<!-- capa de interacción: seleccionar / arrastrar -->
		{#each flow.nodes as n (n.id)}
			{#if n.stmtId}
				<div
					data-node
					role="button"
					tabindex="0"
					draggable="true"
					ondragstart={(e) => startMove(e, n)}
					ondragend={() => dragging.set(null)}
					onclick={(e) => clickNode(e, n.stmtId!)}
					onkeydown={() => {}}
					title="clic: seleccionar · arrastrar: mover"
					class="absolute cursor-grab rounded active:cursor-grabbing"
					style="left:{n.cx - n.w / 2}px; top:{n.y}px; width:{n.w}px; height:{n.h}px"
				></div>
			{/if}
		{/each}

		<!-- zonas de drop -->
		{#each flow.drops as d (d.key)}
			<div
				role="presentation"
				ondragover={(e) => allow(e, d.key)}
				ondragleave={() => { if (overKey === d.key) overKey = null; }}
				ondrop={(e) => drop(e, d)}
				class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed transition-all {overKey === d.key
					? 'scale-110 border-emerald-400 bg-emerald-500/40 shadow-[0_0_14px_2px_rgba(52,211,153,0.6)]'
					: $dragging
						? 'border-emerald-600/70 bg-emerald-900/20'
						: 'pointer-events-none border-transparent'}"
				style="left:{d.cx}px; top:{d.cy}px; width:{NW}px; height:20px"
			></div>
		{/each}

		<!-- marco de selección -->
		{#if marq}
			{@const r = marqRect()}
			<div class="pointer-events-none absolute border border-sky-400 bg-sky-400/15" style="left:{r.x}px; top:{r.y}px; width:{r.w}px; height:{r.h}px"></div>
		{/if}
	</div>

	<!-- barra de selección múltiple -->
	{#if $selection.size > 1}
		<div data-panel class="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-sky-300 bg-white/95 px-3 py-1.5 text-xs text-zinc-700 shadow-xl backdrop-blur dark:border-sky-800 dark:bg-zinc-900/95 dark:text-zinc-200">
			<span class="font-semibold text-sky-300">{$selection.size} seleccionados</span>
			<button class="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onclick={copy}>Copiar</button>
			<button class="rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800" onclick={duplicate}>Duplicar</button>
			<button class="rounded border border-rose-800 px-2 py-0.5 text-rose-300 hover:bg-rose-950/40" onclick={deleteSel}>Borrar</button>
		</div>
	{/if}

	<!-- editor del bloque (selección única) -->
	{#if single}
		<div data-panel class="absolute right-3 top-3 w-64 rounded-lg border border-sky-300 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-sky-800 dark:bg-zinc-900/95">
			<NodeEditor stmt={single} {onchange} ondelete={() => del(single.id)} onduplicate={duplicate} oncopy={copy} onpaste={paste} onclose={() => clearSelection()} />
		</div>
	{/if}
</div>

<p class="pointer-events-none fixed bottom-2 left-1/2 z-10 -translate-x-1/2 rounded bg-white/80 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-900/70">
	arrastra para seleccionar varios · Ctrl/⌘+C copiar · Ctrl/⌘+V pegar · Supr borrar
</p>
