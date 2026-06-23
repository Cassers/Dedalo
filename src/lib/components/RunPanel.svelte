<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { execute, RuntimeError, type Snapshot, type Value } from '$lib/interp/run';
	import { activeStmtId } from '$lib/dfd/active';

	let { program, input = $bindable('') }: { program: Program; input?: string } = $props();

	let gen: Generator<Snapshot, void, void> | null = null;
	let running = $state(false);
	let finished = $state(false);
	let error = $state<string | null>(null);
	let vars = $state<Record<string, Value>>({});
	let output = $state<string[]>([]);
	let speed = $state(350); // ms entre pasos
	let timer: ReturnType<typeof setTimeout> | null = null;

	function reset() {
		if (timer) clearTimeout(timer);
		timer = null;
		gen = null;
		running = false;
		finished = false;
		error = null;
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

	function step(): boolean {
		ensure();
		try {
			const r = gen!.next();
			if (r.done) {
				finished = true;
				running = false;
				activeStmtId.set(null);
				return false;
			}
			activeStmtId.set(r.value.nodeId);
			vars = r.value.vars;
			output = r.value.output;
			return true;
		} catch (e) {
			error = e instanceof RuntimeError ? e.message : 'Error en ejecución';
			running = false;
			activeStmtId.set(null);
			return false;
		}
	}

	function tick() {
		if (!running) return;
		const cont = step();
		if (cont) timer = setTimeout(tick, speed);
		else running = false;
	}

	function run() {
		if (finished) reset();
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
	<div>
		<div class="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Entrada (stdin)</div>
		<textarea
			bind:value={input}
			rows="2"
			placeholder="valores separados por espacios o saltos de línea"
			class="w-full rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-zinc-100 focus:border-sky-500 focus:outline-none"
		></textarea>
	</div>

	<div class="flex flex-wrap items-center gap-1.5">
		{#if running}
			<button class="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500" onclick={pause}>⏸ Pausar</button>
		{:else}
			<button class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500" onclick={run}>▶ Correr</button>
		{/if}
		<button class="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800" onclick={() => step()} disabled={running}>⏭ Paso</button>
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
