<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { SAMPLES } from '$lib/ir/samples';
	import DfdCanvas from '$lib/components/DfdCanvas.svelte';
	import Outline from '$lib/components/Outline.svelte';
	import CodePanel from '$lib/components/CodePanel.svelte';
	import RunPanel from '$lib/components/RunPanel.svelte';
	import { selectedStmtId } from '$lib/dfd/active';

	let program = $state<Program>(SAMPLES[0].build());
	let input = $state(SAMPLES[0].input);
	let sampleKey = $state(SAMPLES[0].key);

	// Reasignar el objeto fuerza el recálculo de diagrama + código.
	function touch() {
		program = { ...program, body: program.body };
	}

	function loadSample(key: string) {
		const s = SAMPLES.find((x) => x.key === key);
		if (!s) return;
		program = s.build();
		input = s.input;
		sampleKey = key;
		selectedStmtId.set(null);
	}
</script>

<div class="flex h-screen flex-col bg-zinc-950">
	<!-- barra superior -->
	<header class="flex items-center gap-3 border-b border-zinc-800 px-4 py-2">
		<span class="text-lg font-bold text-zinc-100">Dédalo</span>
		<span class="text-xs text-zinc-500">programa con diagramas de flujo</span>
		<div class="ml-auto flex items-center gap-2">
			<span class="text-xs text-zinc-500">ejemplo</span>
			<select
				value={sampleKey}
				onchange={(e) => loadSample((e.target as HTMLSelectElement).value)}
				class="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
			>
				{#each SAMPLES as s (s.key)}<option value={s.key}>{s.title}</option>{/each}
			</select>
		</div>
	</header>

	<div class="flex min-h-0 flex-1">
		<!-- izquierda: editor de esquema -->
		<aside class="flex w-80 shrink-0 flex-col border-r border-zinc-800">
			<div class="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
				Construir algoritmo
			</div>
			<div class="min-h-0 flex-1 overflow-auto p-3">
				<Outline block={program.body} onchange={touch} />
			</div>
		</aside>

		<!-- centro: diagrama -->
		<main class="min-w-0 flex-1">
			<DfdCanvas {program} />
		</main>

		<!-- derecha: código + ejecución -->
		<aside class="flex w-96 shrink-0 flex-col border-l border-zinc-800">
			<div class="h-1/2 min-h-0 border-b border-zinc-800">
				<CodePanel {program} />
			</div>
			<div class="h-1/2 min-h-0">
				<RunPanel {program} bind:input />
			</div>
		</aside>
	</div>
</div>
