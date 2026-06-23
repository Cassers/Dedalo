<script lang="ts">
	import type { Stmt } from '$lib/ir/ast';
	import { assign, read, write, iff, whilst, forr, dowhile, num, v } from '$lib/ir/ast';
	import { exprText } from '$lib/dfd/labels';
	import { tryParseExpr } from '$lib/ir/parse';
	import { removeStmt, moveStmt } from '$lib/ir/edit';
	import { selectedStmtId } from '$lib/dfd/active';
	import Self from './Outline.svelte';

	let {
		block,
		onchange,
		depth = 0
	}: { block: Stmt[]; onchange: () => void; depth?: number } = $props();

	// --- helpers de edición de expresiones por texto ---
	function setExpr(target: { value: string }, apply: (text: string) => void) {
		const r = tryParseExpr(target.value);
		if (r.expr) {
			apply(target.value);
			onchange();
		}
	}

	function add(kind: Stmt['kind']) {
		const map: Record<Stmt['kind'], () => Stmt> = {
			assign: () => assign('x', num(0)),
			read: () => read('x'),
			write: () => write(v('x')),
			if: () => iff(v('x'), [], []),
			while: () => whilst(v('x'), []),
			for: () => forr('i', num(1), num(10), []),
			dowhile: () => dowhile([], v('x'))
		};
		block.push(map[kind]());
		onchange();
	}

	function del(id: string) {
		removeStmt(block, id);
		selectedStmtId.set(null);
		onchange();
	}
	function move(id: string, dir: -1 | 1) {
		moveStmt(block, id, dir);
		onchange();
	}

	const PALETTE: { kind: Stmt['kind']; label: string; cls: string }[] = [
		{ kind: 'assign', label: '← Asignar', cls: 'border-zinc-600' },
		{ kind: 'read', label: 'Leer', cls: 'border-violet-600' },
		{ kind: 'write', label: 'Escribir', cls: 'border-violet-600' },
		{ kind: 'if', label: 'Si', cls: 'border-amber-600' },
		{ kind: 'while', label: 'Mientras', cls: 'border-amber-600' },
		{ kind: 'for', label: 'Para', cls: 'border-amber-600' },
		{ kind: 'dowhile', label: 'Repetir', cls: 'border-amber-600' }
	];

	const sel = $derived($selectedStmtId);
	const inp = 'rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-100 focus:border-sky-500 focus:outline-none';
</script>

<div class="flex flex-col gap-1.5" style="margin-left: {depth ? 12 : 0}px">
	{#each block as s (s.id)}
		<div
			class="rounded border px-2 py-1.5 text-xs {sel === s.id ? 'border-sky-500 bg-sky-950/30' : 'border-zinc-800 bg-zinc-900/60'}"
			role="button"
			tabindex="0"
			onclick={(e) => { e.stopPropagation(); selectedStmtId.set(s.id); }}
			onkeydown={() => {}}
		>
			<div class="flex items-center gap-1.5">
				<!-- editor por tipo -->
				{#if s.kind === 'assign'}
					<input class="{inp} w-16" value={s.target} onchange={(e) => { s.target = (e.target as HTMLInputElement).value; onchange(); }} />
					<span class="text-zinc-500">←</span>
					<input class="{inp} flex-1" value={exprText(s.expr)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.expr = tryParseExpr(t).expr!))} />
				{:else if s.kind === 'read'}
					<span class="text-violet-400">Leer</span>
					<input class="{inp} flex-1" value={s.vars.join(', ')} onchange={(e) => { s.vars = (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean); onchange(); }} />
				{:else if s.kind === 'write'}
					<span class="text-violet-400">Escribir</span>
					<input class="{inp} flex-1" value={s.exprs.map(exprText).join(', ')} onchange={(e) => { const parts = (e.target as HTMLInputElement).value.split(',').map((x) => tryParseExpr(x.trim()).expr).filter(Boolean); if (parts.length) { s.exprs = parts as typeof s.exprs; onchange(); } }} />
				{:else if s.kind === 'if'}
					<span class="text-amber-400">Si</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.cond = tryParseExpr(t).expr!))} />
				{:else if s.kind === 'while'}
					<span class="text-amber-400">Mientras</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.cond = tryParseExpr(t).expr!))} />
				{:else if s.kind === 'dowhile'}
					<span class="text-amber-400">Repetir hasta</span>
					<input class="{inp} flex-1" value={exprText(s.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.cond = tryParseExpr(t).expr!))} />
				{:else if s.kind === 'for'}
					<span class="text-amber-400">Para</span>
					<input class="{inp} w-12" value={s.var} onchange={(e) => { s.var = (e.target as HTMLInputElement).value; onchange(); }} />
					<span class="text-zinc-500">de</span>
					<input class="{inp} w-14" value={exprText(s.from)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.from = tryParseExpr(t).expr!))} />
					<span class="text-zinc-500">a</span>
					<input class="{inp} w-14" value={exprText(s.to)} onchange={(e) => setExpr(e.target as HTMLInputElement, (t) => (s.to = tryParseExpr(t).expr!))} />
				{/if}

				<div class="ml-auto flex items-center gap-1 text-zinc-500">
					<button title="subir" class="hover:text-zinc-200" onclick={(e) => { e.stopPropagation(); move(s.id, -1); }}>↑</button>
					<button title="bajar" class="hover:text-zinc-200" onclick={(e) => { e.stopPropagation(); move(s.id, 1); }}>↓</button>
					<button title="borrar" class="hover:text-rose-400" onclick={(e) => { e.stopPropagation(); del(s.id); }}>✕</button>
				</div>
			</div>

			<!-- ramas anidadas -->
			{#if s.kind === 'if'}
				<div class="mt-1.5">
					<div class="text-[10px] uppercase tracking-wide text-emerald-500">entonces</div>
					<Self block={s.then} {onchange} depth={depth + 1} />
					<div class="mt-1 text-[10px] uppercase tracking-wide text-rose-500">si no</div>
					<Self block={s.else} {onchange} depth={depth + 1} />
				</div>
			{:else if s.kind === 'while' || s.kind === 'for' || s.kind === 'dowhile'}
				<div class="mt-1.5">
					<div class="text-[10px] uppercase tracking-wide text-amber-500">repetir</div>
					<Self block={s.body} {onchange} depth={depth + 1} />
				</div>
			{/if}
		</div>
	{/each}

	<!-- paleta para agregar al final de este bloque -->
	<div class="flex flex-wrap gap-1">
		{#each PALETTE as p (p.kind)}
			<button
				class="rounded border {p.cls} bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800"
				onclick={(e) => { e.stopPropagation(); add(p.kind); }}
			>
				+ {p.label}
			</button>
		{/each}
	</div>
</div>
