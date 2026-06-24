<script lang="ts">
	import type { Stmt } from '$lib/ir/ast';
	import { exprText } from '$lib/dfd/labels';
	import { tryParseExpr } from '$lib/ir/parse';
	import { META } from '$lib/dfd/blockmeta';

	let {
		stmt,
		onchange,
		ondelete,
		onduplicate,
		onclose
	}: { stmt: Stmt; onchange: () => void; ondelete: () => void; onduplicate: () => void; onclose: () => void } = $props();

	const lbl = 'mb-1 text-[10px] uppercase tracking-wide text-zinc-500';
	const inp =
		'w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100 focus:border-sky-400 focus:outline-none';

	function setExpr(el: HTMLInputElement, apply: (e: NonNullable<ReturnType<typeof tryParseExpr>['expr']>) => void) {
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

<div class="mb-2 flex items-center justify-between">
	<span class="text-xs font-semibold text-zinc-200">Editar · {META[stmt.kind].label}</span>
	<button class="text-zinc-500 hover:text-zinc-200" onclick={onclose} title="cerrar">✕</button>
</div>

<div class="flex flex-col gap-2">
	{#if stmt.kind === 'assign'}
		<div>
			<div class={lbl}>Variable</div>
			<input class={inp} value={stmt.target} onchange={(e) => { stmt.target = (e.target as HTMLInputElement).value; onchange(); }} />
		</div>
		<div>
			<div class={lbl}>Valor (expresión)</div>
			<input class={inp} value={exprText(stmt.expr)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (stmt.expr = x))} />
		</div>
	{:else if stmt.kind === 'read'}
		<div>
			<div class={lbl}>Variables a leer (coma)</div>
			<input class={inp} value={stmt.vars.join(', ')} onchange={(e) => { stmt.vars = (e.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean); onchange(); }} />
		</div>
	{:else if stmt.kind === 'write'}
		<div>
			<div class={lbl}>Expresiones a escribir (coma)</div>
			<input class={inp} value={stmt.exprs.map(exprText).join(', ')} onchange={(e) => { const ps = (e.target as HTMLInputElement).value.split(',').map((x) => tryParseExpr(x.trim()).expr).filter(Boolean); if (ps.length) { stmt.exprs = ps as typeof stmt.exprs; onchange(); } }} />
		</div>
	{:else if stmt.kind === 'if' || stmt.kind === 'while' || stmt.kind === 'dowhile'}
		<div>
			<div class={lbl}>Condición</div>
			<input class={inp} value={exprText(stmt.cond)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (stmt.cond = x))} />
		</div>
	{:else if stmt.kind === 'for'}
		<div>
			<div class={lbl}>Variable</div>
			<input class={inp} value={stmt.var} onchange={(e) => { stmt.var = (e.target as HTMLInputElement).value; onchange(); }} />
		</div>
		<div class="flex gap-2">
			<div class="flex-1">
				<div class={lbl}>Desde</div>
				<input class={inp} value={exprText(stmt.from)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (stmt.from = x))} />
			</div>
			<div class="flex-1">
				<div class={lbl}>Hasta</div>
				<input class={inp} value={exprText(stmt.to)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (stmt.to = x))} />
			</div>
		</div>
	{/if}

	<div class="mt-1 flex gap-2">
		<button class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800" onclick={onduplicate}>Duplicar</button>
		<button class="rounded border border-rose-800 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950/40" onclick={ondelete}>Borrar</button>
	</div>
</div>
