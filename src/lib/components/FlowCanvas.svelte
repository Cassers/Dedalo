<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { createStmt } from '$lib/ir/ast';
	import { buildFlow, type FlowNode } from '$lib/dfd/flowlayout';
	import { insertAt, moveTo, removeStmt, findStmt } from '$lib/ir/edit';
	import { activeStmtId, selectedStmtId } from '$lib/dfd/active';
	import { dragging } from '$lib/dnd';
	import NodeEditor from './NodeEditor.svelte';

	let { program, onchange }: { program: Program; onchange: () => void } = $props();

	const flow = $derived(buildFlow(program.body));
	const NW = 172;

	let overKey = $state<string | null>(null);

	function shapePoints(n: FlowNode): string {
		const x = n.cx - n.w / 2;
		if (n.shape === 'io') {
			const s = 12;
			return `${x + s},${n.y} ${x + n.w},${n.y} ${x + n.w - s},${n.y + n.h} ${x},${n.y + n.h}`;
		}
		// decision (rombo)
		return `${n.cx},${n.y} ${x + n.w},${n.y + n.h / 2} ${n.cx},${n.y + n.h} ${x},${n.y + n.h / 2}`;
	}

	function fillFor(n: FlowNode) {
		if (n.shape === 'oval') return n.label === 'Fin' ? '#4c0519' : '#052e16';
		if (n.shape === 'io') return 'rgba(124,58,237,0.28)';
		if (n.shape === 'decision') return 'rgba(180,83,9,0.28)';
		return '#27272a';
	}
	function strokeFor(n: FlowNode) {
		if (n.shape === 'oval') return n.label === 'Fin' ? '#e11d48' : '#10b981';
		if (n.shape === 'io') return '#8b5cf6';
		if (n.shape === 'decision') return '#f59e0b';
		return '#71717a';
	}
	const trunc = (s: string) => (s.length > 26 ? s.slice(0, 25) + '…' : s);

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
		if (p.type === 'new') insertAt(program, d.parentId, d.branch, d.index, createStmt(p.kind));
		else moveTo(program, p.id, d.parentId, d.branch, d.index);
		dragging.set(null);
		onchange();
	}
	const movingId = $derived($dragging?.type === 'move' ? $dragging.id : null);

	function startMove(e: DragEvent, n: FlowNode) {
		if (!n.stmtId) return;
		dragging.set({ type: 'move', id: n.stmtId });
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', n.stmtId);
			e.dataTransfer.effectAllowed = 'move';
			// Fantasma visible que sigue al cursor (la capa real es transparente).
			const ghost = document.createElement('div');
			ghost.textContent = n.label;
			ghost.style.cssText =
				`position:fixed;top:-1000px;left:-1000px;padding:6px 12px;border:2px solid ${strokeFor(n)};` +
				`background:#18181b;color:#e4e4e7;border-radius:8px;white-space:nowrap;` +
				`font:600 12px ui-monospace,monospace;box-shadow:0 6px 20px rgba(0,0,0,.5);`;
			document.body.appendChild(ghost);
			e.dataTransfer.setDragImage(ghost, 14, 14);
			setTimeout(() => ghost.remove(), 0);
		}
	}

	const selectedStmt = $derived($selectedStmtId ? findStmt(program.body, $selectedStmtId) : undefined);
	function del(id: string) {
		removeStmt(program.body, id);
		selectedStmtId.set(null);
		onchange();
	}
</script>

<div class="relative h-full w-full overflow-auto">
	<div class="relative mx-auto" style="width:{flow.width}px; height:{flow.height}px">
		<!-- capa SVG: figuras + líneas con flechas -->
		<svg class="absolute inset-0 pointer-events-none" width={flow.width} height={flow.height}>
			<defs>
				<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
					<path d="M 0 0 L 10 5 L 0 10 z" fill="#71717a" />
				</marker>
			</defs>

			{#each flow.edges as e (e.id)}
				<path d={e.d} fill="none" stroke="#71717a" stroke-width="1.6" marker-end="url(#arrow)" />
				{#if e.label}
					<text x={e.lx} y={e.ly} fill="#a1a1aa" font-size="11" font-weight="600" text-anchor="middle">{e.label}</text>
				{/if}
			{/each}

			{#each flow.nodes as n (n.id)}
				{@const active = n.stmtId && $activeStmtId === n.stmtId}
				{@const selected = n.stmtId && $selectedStmtId === n.stmtId}
				{@const moving = n.stmtId && movingId === n.stmtId}
				{@const stroke = active ? '#fbbf24' : selected ? '#38bdf8' : strokeFor(n)}
				<g
					opacity={moving ? 0.35 : 1}
					style={active ? 'filter:drop-shadow(0 0 6px rgba(251,191,36,0.7))' : ''}
				>
					{#if n.shape === 'oval'}
						<rect x={n.cx - n.w / 2} y={n.y} width={n.w} height={n.h} rx={n.h / 2} ry={n.h / 2} fill={fillFor(n)} {stroke} stroke-width="2" stroke-dasharray={moving ? '5 4' : undefined} />
					{:else if n.shape === 'rect'}
						<rect x={n.cx - n.w / 2} y={n.y} width={n.w} height={n.h} rx="6" fill={fillFor(n)} {stroke} stroke-width="2" stroke-dasharray={moving ? '5 4' : undefined} />
					{:else}
						<polygon points={shapePoints(n)} fill={fillFor(n)} {stroke} stroke-width="2" stroke-dasharray={moving ? '5 4' : undefined} />
					{/if}
					<text x={n.cx} y={n.y + n.h / 2 + 4} fill="#e4e4e7" font-size="12.5" text-anchor="middle" font-family="ui-monospace,monospace">{trunc(n.label)}</text>
				</g>
			{/each}
		</svg>

		<!-- capa HTML: interacción (seleccionar / arrastrar para mover) -->
		{#each flow.nodes as n (n.id)}
			{#if n.stmtId}
				<div
					role="button"
					tabindex="0"
					draggable="true"
					ondragstart={(e) => startMove(e, n)}
					ondragend={() => dragging.set(null)}
					onclick={() => selectedStmtId.set(n.stmtId!)}
					onkeydown={() => {}}
					title="clic: editar · arrastrar: mover"
					class="absolute cursor-grab rounded active:cursor-grabbing"
					style="left:{n.cx - n.w / 2}px; top:{n.y}px; width:{n.w}px; height:{n.h}px"
				></div>
			{/if}
		{/each}

		<!-- zonas de drop sobre las líneas -->
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
						: 'border-transparent'}"
				style="left:{d.cx}px; top:{d.cy}px; width:{NW}px; height:20px"
			></div>
		{/each}
	</div>

	<!-- editor flotante del bloque seleccionado -->
	{#if selectedStmt}
		<div class="absolute right-3 top-3 w-64 rounded-lg border border-sky-800 bg-zinc-900/95 p-3 shadow-xl backdrop-blur">
			<NodeEditor stmt={selectedStmt} {onchange} ondelete={() => del(selectedStmt.id)} onclose={() => selectedStmtId.set(null)} />
		</div>
	{/if}
</div>
