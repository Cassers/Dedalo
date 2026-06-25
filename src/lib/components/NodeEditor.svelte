<script lang="ts">
	import type { Stmt } from '$lib/ir/ast';
	import { exprText } from '$lib/dfd/labels';
	import { tryParseExpr } from '$lib/ir/parse';
	import { META } from '$lib/dfd/blockmeta';
	import { functionRegistry } from '$lib/dfd/functions';

	const paramNames = (fnName: string) =>
		$functionRegistry.find((f) => f.name === fnName)?.params ?? [];

	let {
		stmt,
		onchange,
		ondelete,
		onduplicate,
		oncopy,
		onpaste,
		onclose,
		onopenfn
	}: {
		stmt: Stmt;
		onchange: () => void;
		ondelete: () => void;
		onduplicate: () => void;
		oncopy: () => void;
		onpaste: () => void;
		onclose: () => void;
		onopenfn: (fnName: string) => void;
	} = $props();

	const lbl = 'mb-1 text-[10px] uppercase tracking-wide text-zinc-500';
	const btn = 'rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800';
	const inp =
		'w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-900 focus:border-sky-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

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
	<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Editar · {stmt.kind === 'callfn' ? 'Función' : META[stmt.kind].label}</span>
	<button class="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" onclick={onclose} title="cerrar">✕</button>
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
	{:else if stmt.kind === 'callfn'}
		<div class="flex items-center justify-between gap-2">
			<div class="text-[11px] text-teal-600 dark:text-teal-300">Llama a <b class="font-mono">{stmt.fnName}</b></div>
			{#if $functionRegistry.some((f) => f.name === stmt.fnName)}
				<button
					class="shrink-0 rounded border border-teal-500 px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
					onclick={() => onopenfn(stmt.fnName)}
					title="Abrir la definición de {stmt.fnName} en el lienzo"
				>
					Abrir función ↗
				</button>
			{/if}
		</div>
		<div>
			<div class={lbl}>Guardar resultado en (opcional)</div>
			<input class={inp} value={stmt.resultVar ?? ''} placeholder="(no captura)" onchange={(e) => { const val = (e.target as HTMLInputElement).value.trim(); stmt.resultVar = val || undefined; onchange(); }} />
		</div>
		{#each stmt.args as arg, i (i)}
			<div>
				<div class={lbl}>Argumento {paramNames(stmt.fnName)[i] ?? i + 1}</div>
				<input class={inp} value={exprText(arg)} onchange={(e) => setExpr(e.target as HTMLInputElement, (x) => (stmt.args[i] = x))} />
			</div>
		{/each}
	{/if}

	{#if stmt.kind === 'if' || stmt.kind === 'while' || stmt.kind === 'for' || stmt.kind === 'dowhile'}
		<button
			class="self-start rounded border border-sky-700 bg-sky-950/40 px-2 py-1 text-xs text-sky-200 hover:bg-sky-900/50"
			onclick={() => { stmt.flip = !stmt.flip; onchange(); }}
			title="invertir el lado de las ramas/retorno de este bloque"
		>
			⇄ Invertir ramas (Sí: {stmt.flip ? 'izquierda' : 'derecha'})
		</button>
	{/if}

	<div class="mt-1 flex flex-wrap gap-2">
		<button class={btn} onclick={oncopy}>Copiar</button>
		<button class={btn} onclick={onpaste}>Pegar</button>
		<button class={btn} onclick={onduplicate}>Duplicar</button>
		<button class="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40" onclick={ondelete}>Borrar</button>
	</div>
</div>
