<script lang="ts">
	import type { Program, Stmt } from '$lib/ir/ast';
	import { createStmt } from '$lib/ir/ast';
	import type { Branch } from '$lib/ir/edit';
	import { insertAt, moveTo, removeStmt } from '$lib/ir/edit';
	import { exprText } from '$lib/dfd/labels';
	import { tryParseExpr } from '$lib/ir/parse';
	import { META } from '$lib/dfd/blockmeta';
	import { dragging } from '$lib/dnd';
	import { activeStmtId, selectedStmtId } from '$lib/dfd/active';
	import Self from './BlockTree.svelte';

	let {
		program,
		block,
		parentId = null,
		branch = 'body',
		onchange
	}: {
		program: Program;
		block: Stmt[];
		parentId?: string | null;
		branch?: Branch;
		onchange: () => void;
	} = $props();

	let overIndex = $state<number | null>(null);

	function allowDrop(e: DragEvent, index: number) {
		if (!$dragging) return;
		e.preventDefault();
		e.stopPropagation();
		overIndex = index;
		if (e.dataTransfer) e.dataTransfer.dropEffect = $dragging.type === 'new' ? 'copy' : 'move';
	}
	function leave(index: number) {
		if (overIndex === index) overIndex = null;
	}
	function onDrop(e: DragEvent, index: number) {
		e.preventDefault();
		e.stopPropagation();
		overIndex = null;
		const d = $dragging;
		if (!d) return;
		if (d.type === 'new') insertAt(program, parentId, branch, index, createStmt(d.kind));
		else moveTo(program, d.id, parentId, branch, index);
		dragging.set(null);
		onchange();
	}

	function startMove(e: DragEvent, id: string) {
		e.stopPropagation();
		dragging.set({ type: 'move', id });
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function del(id: string) {
		removeStmt(program.body, id);
		selectedStmtId.set(null);
		onchange();
	}

	const inp =
		'rounded border border-zinc-700 bg-zinc-950/80 px-1.5 py-0.5 font-mono text-xs text-zinc-100 focus:border-sky-400 focus:outline-none';
	function setExpr(el: HTMLInputElement, apply: (e: ReturnType<typeof tryParseExpr>['expr']) => void) {
		const r = tryParseExpr(el.value);
		if (r.expr) {
			apply(r.expr);
			el.classList.remove('border-rose-500');
			onchange();
		} else {
			el.classList.add('border-rose-500');
		}
	}
</script>

{#snippet slot(index: number)}
	<div
		role="presentation"
		ondragover={(e) => allowDrop(e, index)}
		ondragleave={() => leave(index)}
		ondrop={(e) => onDrop(e, index)}
		class="my-0.5 rounded transition-all {overIndex === index
			? 'h-7 border-2 border-dashed border-emerald-400 bg-emerald-500/15'
			: $dragging
				? 'h-3 bg-zinc-800/40'
				: 'h-1.5'}"
	></div>
{/snippet}

{#snippet emptyZone()}
	<div
		role="presentation"
		ondragover={(e) => allowDrop(e, 0)}
		ondragleave={() => leave(0)}
		ondrop={(e) => onDrop(e, 0)}
		class="my-0.5 flex h-10 items-center justify-center rounded border-2 border-dashed text-[11px] transition-all {overIndex === 0
			? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
			: 'border-zinc-700 text-zinc-600'}"
	>
		suelta un bloque aquí
	</div>
{/snippet}

<div class="flex flex-col">
	{#if block.length === 0}
		{@render emptyZone()}
	{/if}
	{#each block as s, i (s.id)}
		{@render slot(i)}
		{@const m = META[s.kind]}
		{@const active = $activeStmtId === s.id}
		<div
			role="button"
			tabindex="0"
			onclick={(e) => {
				e.stopPropagation();
				selectedStmtId.set(s.id);
			}}
			onkeydown={() => {}}
			class="rounded-lg border-2 {m.cls} {active
				? 'ring-2 ring-amber-300 shadow-[0_0_16px_2px_rgba(251,191,36,0.5)]'
				: $selectedStmtId === s.id
					? 'ring-1 ring-sky-400'
					: ''}"
		>
			<div class="flex items-center gap-1.5 px-2 py-1.5">
				<!-- grip: solo esto arranca el arrastre -->
				<span
					role="button"
					tabindex="0"
					draggable="true"
					ondragstart={(e) => startMove(e, s.id)}
					ondragend={() => dragging.set(null)}
					class="cursor-grab select-none text-zinc-500 hover:text-zinc-300 active:cursor-grabbing"
					title="arrastrar">⠿</span
				>

				{#if s.kind === 'assign'}
					<input class="{inp} w-16" value={s.target} onchange={(e) => { s.target = (e.target as HTMLInputElement).value; onchange(); }} />
					<span class="text-zinc-400">←</span>
					<input class="{inp} flex-1" value={exprText(s.expr)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.expr = x!))} />
				{:else if s.kind === 'read'}
					<span class="text-violet-300">Leer</span>
					<input class="{inp} flex-1" value={s.vars.join(', ')} onchange={(e) => { s.vars = (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean); onchange(); }} />
				{:else if s.kind === 'write'}
					<span class="text-violet-300">Escribir</span>
					<input class="{inp} flex-1" value={s.exprs.map(exprText).join(', ')} onchange={(e) => { const ps = (e.target as HTMLInputElement).value.split(',').map((x) => tryParseExpr(x.trim()).expr).filter(Boolean); if (ps.length) { s.exprs = ps as typeof s.exprs; onchange(); } }} />
				{:else if s.kind === 'if'}
					<span class="text-amber-300">◇ Si</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.cond = x!))} />
				{:else if s.kind === 'while'}
					<span class="text-sky-300">↻ Mientras</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.cond = x!))} />
				{:else if s.kind === 'dowhile'}
					<span class="text-sky-300">↻ Repetir hasta</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.cond = x!))} />
				{:else if s.kind === 'for'}
					<span class="text-sky-300">↻ Para</span>
					<input class="{inp} w-12" value={s.var} onchange={(e) => { s.var = (e.target as HTMLInputElement).value; onchange(); }} />
					<span class="text-zinc-400">de</span>
					<input class="{inp} w-14" value={exprText(s.from)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.from = x!))} />
					<span class="text-zinc-400">a</span>
					<input class="{inp} w-14" value={exprText(s.to)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (s.to = x!))} />
				{/if}

				<button class="ml-auto text-zinc-500 hover:text-rose-400" title="borrar" onclick={(e) => { e.stopPropagation(); del(s.id); }}>✕</button>
			</div>

			<!-- ramas anidadas -->
			{#if s.kind === 'if'}
				<div class="px-2 pb-2">
					<!-- bifurcación: la decisión se abre en dos caminos -->
					<div class="relative h-4">
						<div class="absolute top-0 left-1/2 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
						<div class="absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-amber-600"></div>
						<div class="absolute bottom-0 left-1/4 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
						<div class="absolute bottom-0 left-3/4 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
					</div>
					<div class="flex items-start">
						<div class="flex w-1/2 flex-col px-1">
							<span class="mb-1 self-center rounded-full border border-emerald-600 bg-emerald-950/60 px-2 text-[10px] font-semibold uppercase text-emerald-300">Sí</span>
							<Self {program} block={s.then} parentId={s.id} branch="then" {onchange} />
						</div>
						<div class="flex w-1/2 flex-col px-1">
							<span class="mb-1 self-center rounded-full border border-rose-600 bg-rose-950/60 px-2 text-[10px] font-semibold uppercase text-rose-300">No</span>
							<Self {program} block={s.else} parentId={s.id} branch="else" {onchange} />
						</div>
					</div>
					<!-- los caminos se reúnen -->
					<div class="relative h-4">
						<div class="absolute top-0 left-1/4 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
						<div class="absolute top-0 left-3/4 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
						<div class="absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-amber-600"></div>
						<div class="absolute bottom-0 left-1/2 h-1/2 w-0.5 -translate-x-1/2 bg-amber-600"></div>
					</div>
				</div>
			{:else if s.kind === 'while' || s.kind === 'for' || s.kind === 'dowhile'}
				<div class="ml-3 mb-2 border-l-2 border-sky-700/60 pl-2">
					<div class="py-0.5 text-[10px] uppercase tracking-wide text-sky-400">repetir →</div>
					<Self {program} block={s.body} parentId={s.id} branch="body" {onchange} />
				</div>
			{/if}
		</div>
	{/each}
	{@render slot(block.length)}
</div>
