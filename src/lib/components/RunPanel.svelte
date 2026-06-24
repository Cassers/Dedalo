<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { execute, RuntimeError, type Step, type Value } from '$lib/interp/run';
	import { activeStmtId } from '$lib/dfd/active';
	import { tick as svelteTick } from 'svelte';

	let { program, input = $bindable('') }: { program: Program; input?: string } = $props();

	let gen: Generator<Step, void, string> | null = null;
	let running = $state(false);
	let finished = $state(false);
	let error = $state<string | null>(null);
	let vars = $state<Record<string, Value>>({});
	let output = $state<string[]>([]);
	let speed = $state(350); // ms entre pasos
	let timer: ReturnType<typeof setTimeout> | null = null;

	// Cuando el programa pide un valor (Leer), pausamos y mostramos este prompt.
	let waiting = $state<{ varName: string } | null>(null);
	let inputValue = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);

	function reset() {
		if (timer) clearTimeout(timer);
		timer = null;
		gen = null;
		running = false;
		finished = false;
		error = null;
		waiting = null;
		vars = {};
		output = [];
		activeStmtId.set(null);
	}

	function ensure() {
		if (!gen) {
			gen = execute(program, input);
			finished = false;
			error = null;
		}
	}

	/** Avanza el generador con `sent` (valor de entrada o undefined). Devuelve:
	 *  'cont' = siguió, 'done' = terminó, 'wait' = pidió entrada, 'error'. */
	function advance(sent?: string): 'cont' | 'done' | 'wait' | 'error' {
		ensure();
		try {
			const r = sent === undefined ? gen!.next() : gen!.next(sent);
			if (r.done) {
				finished = true;
				running = false;
				activeStmtId.set(null);
				return 'done';
			}
			if (r.value.type === 'input') {
				activeStmtId.set(r.value.nodeId);
				waiting = { varName: r.value.varName };
				running = false; // espera al usuario
				focusInput();
				return 'wait';
			}
			activeStmtId.set(r.value.snap.nodeId);
			vars = r.value.snap.vars;
			output = r.value.snap.output;
			return 'cont';
		} catch (e) {
			error = e instanceof RuntimeError ? e.message : 'Error en ejecución';
			running = false;
			activeStmtId.set(null);
			return 'error';
		}
	}

	async function focusInput() {
		await svelteTick();
		inputEl?.focus();
	}

	function step() {
		if (waiting) return; // hay que responder el prompt primero
		advance();
	}

	function tick() {
		if (!running) return;
		const r = advance();
		if (r === 'cont') timer = setTimeout(tick, speed);
		else running = false; // done / wait / error
	}

	function submitInput() {
		if (!waiting) return;
		const v = inputValue;
		inputValue = '';
		waiting = null;
		advance(v); // entrega el valor al programa
		// si veníamos corriendo en automático, seguimos
		if (!finished && !error && !waiting) {
			running = true;
			tick();
		}
	}

	function run() {
		if (finished) reset();
		if (waiting) return; // espera respuesta
		running = true;
		tick();
	}
	function pause() {
		running = false;
		if (timer) clearTimeout(timer);
	}

	// Si el algoritmo cambia (edición), reiniciamos la corrida.
	$effect(() => {
		void program;
		reset();
	});
</script>

<div class="flex h-full flex-col gap-2 p-2">
	<details class="text-[11px]">
		<summary class="cursor-pointer select-none text-zinc-500 hover:text-zinc-300">
			Entrada precargada <span class="text-zinc-600">(opcional)</span>
		</summary>
		<textarea
			bind:value={input}
			rows="2"
			placeholder="valores separados por espacios/saltos; si lo dejas vacío se te pedirán al correr"
			class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
		></textarea>
	</details>

	{#if waiting}
		<div class="rounded border border-sky-700 bg-sky-950/40 p-2">
			<div class="mb-1 text-xs text-sky-200">El programa pide: <b class="font-mono">{waiting.varName}</b> = ?</div>
			<div class="flex gap-2">
				<!-- svelte-ignore a11y_autofocus -->
				<input
					bind:this={inputEl}
					bind:value={inputValue}
					autofocus
					onkeydown={(e) => { if (e.key === 'Enter') submitInput(); }}
					placeholder="escribe un valor y Enter"
					class="flex-1 rounded border border-sky-600 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-100 focus:outline-none"
				/>
				<button class="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500" onclick={submitInput}>Enviar</button>
			</div>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-1.5">
		{#if running}
			<button class="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500" onclick={pause}>⏸ Pausar</button>
		{:else}
			<button class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50" onclick={run} disabled={!!waiting}>▶ Correr</button>
		{/if}
		<button class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50" onclick={() => step()} disabled={running || !!waiting}>⏭ Paso</button>
		<button class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800" onclick={reset}>↺ Reiniciar</button>
		<label class="ml-auto flex items-center gap-1 text-[11px] text-zinc-500">
			velocidad
			<input type="range" min="40" max="800" step="20" bind:value={speed} class="w-20" />
		</label>
	</div>

	{#if error}
		<div class="rounded border border-rose-800 bg-rose-950/40 p-2 text-xs text-rose-300">⚠ {error}</div>
	{/if}

	<div class="grid min-h-0 flex-1 grid-rows-2 gap-2">
		<div class="flex min-h-0 flex-col">
			<div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Salida {finished ? '· terminó' : ''}</div>
			<pre class="flex-1 overflow-auto rounded border border-zinc-800 bg-black p-2 font-mono text-xs text-emerald-300">{output.join('\n')}</pre>
		</div>
		<div class="flex min-h-0 flex-col">
			<div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Variables</div>
			<div class="flex-1 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2">
				{#each Object.entries(vars) as [k, val] (k)}
					<div class="flex justify-between font-mono text-xs">
						<span class="text-sky-300">{k}</span>
						<span class="text-zinc-200">{String(val)}</span>
					</div>
				{:else}
					<div class="text-xs text-zinc-600">— sin variables aún —</div>
				{/each}
			</div>
		</div>
	</div>
</div>
