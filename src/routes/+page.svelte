<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { SAMPLES } from '$lib/ir/samples';
	import BlockPalette from '$lib/components/BlockPalette.svelte';
	import FlowCanvas from '$lib/components/FlowCanvas.svelte';
	import CodePanel from '$lib/components/CodePanel.svelte';
	import RunPanel from '$lib/components/RunPanel.svelte';
	import { clearSelection } from '$lib/dfd/active';
	import { theme } from '$lib/theme';

	let program = $state<Program>(SAMPLES[0].build());
	let input = $state(SAMPLES[0].input);
	let sampleKey = $state(SAMPLES[0].key);

	// --- Historial deshacer/rehacer ---
	const snap = () => $state.snapshot(program) as Program; // copia plana profunda
	let undoStack = $state<Program[]>([]);
	let redoStack = $state<Program[]>([]);
	let committed: Program = snap(); // estado confirmado actual

	// Reasignar el objeto fuerza el recálculo de código + diagrama.
	function touch() {
		undoStack = [...undoStack.slice(-99), committed]; // guarda el estado previo
		redoStack = [];
		committed = snap();
		program = { ...program, body: program.body };
	}
	function undo() {
		if (!undoStack.length) return;
		redoStack = [...redoStack, committed];
		const prev = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		program = structuredClone(prev);
		committed = structuredClone(prev);
		clearSelection();
	}
	function redo() {
		if (!redoStack.length) return;
		undoStack = [...undoStack, committed];
		const next = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		program = structuredClone(next);
		committed = structuredClone(next);
		clearSelection();
	}
	function resetHistory() {
		undoStack = [];
		redoStack = [];
		committed = snap();
	}

	function loadSample(key: string) {
		if (key === '__blank__') {
			program = { name: 'Mi algoritmo', body: [] };
			input = '';
			sampleKey = key;
			clearSelection();
			resetHistory();
			return;
		}
		const s = SAMPLES.find((x) => x.key === key);
		if (!s) return;
		program = s.build();
		input = s.input;
		sampleKey = key;
		clearSelection();
		resetHistory();
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
		const mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		const k = e.key.toLowerCase();
		if (k === 'z' && !e.shiftKey) {
			undo();
			e.preventDefault();
		} else if (k === 'y' || (k === 'z' && e.shiftKey)) {
			redo();
			e.preventDefault();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
	<header class="flex items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
		<span class="text-lg font-bold text-zinc-900 dark:text-zinc-100">Dédalo</span>
		<span class="text-xs text-zinc-500">programa con diagramas de flujo</span>
		<div class="ml-3 flex items-center gap-1">
			<button
				onclick={undo}
				disabled={!undoStack.length}
				title="Deshacer (Ctrl/⌘+Z)"
				class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
			>↶</button>
			<button
				onclick={redo}
				disabled={!redoStack.length}
				title="Rehacer (Ctrl/⌘+Shift+Z)"
				class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
			>↷</button>
		</div>
		<div class="ml-auto flex items-center gap-2">
			<select
				value={$theme}
				onchange={(e) => theme.set((e.target as HTMLSelectElement).value as 'light' | 'dark' | 'auto')}
				title="Tema"
				class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
			>
				<option value="auto">🌗 Automático</option>
				<option value="light">☀️ Claro</option>
				<option value="dark">🌙 Oscuro</option>
			</select>
			<span class="text-xs text-zinc-500">empezar con</span>
			<select
				value={sampleKey}
				onchange={(e) => loadSample((e.target as HTMLSelectElement).value)}
				class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
			>
				<option value="__blank__">— lienzo vacío —</option>
				{#each SAMPLES as s (s.key)}<option value={s.key}>{s.title}</option>{/each}
			</select>
		</div>
	</header>

	<div class="flex min-h-0 flex-1">
		<!-- izquierda: paleta de bloques -->
		<aside class="flex w-56 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
			<div class="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
				Bloques
			</div>
			<div class="min-h-0 flex-1 overflow-auto">
				<BlockPalette />
			</div>
		</aside>

		<!-- centro: diagrama de flujo (arrastra aquí) -->
		<main class="min-w-0 flex-1 bg-[radial-gradient(circle,#d4d4d8_1px,transparent_1px)] [background-size:22px_22px] dark:bg-[radial-gradient(circle,#18181b_1px,transparent_1px)]">
			<FlowCanvas {program} onchange={touch} />
		</main>

		<!-- derecha: código + ejecución -->
		<aside class="flex w-96 shrink-0 flex-col border-l border-zinc-200 dark:border-zinc-800">
			<div class="h-1/2 min-h-0 border-b border-zinc-200 dark:border-zinc-800">
				<CodePanel {program} />
			</div>
			<div class="h-1/2 min-h-0">
				<RunPanel {program} bind:input />
			</div>
		</aside>
	</div>
</div>
