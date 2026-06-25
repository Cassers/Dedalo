<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { generate } from '$lib/codegen';
	import { functionRegistry } from '$lib/dfd/functions';
	import { get } from 'svelte/store';

	interface Summary { slug: string; title: string; difficulty: string; mode: string }
	interface Detail extends Summary {
		statement: string;
		languages: string[];
		starters: Record<string, string>;
		samples: { stdin: string; expectedOutput: string }[];
	}
	interface Verdict {
		verdict: string;
		passedCount: number;
		totalCount: number;
		cases?: { ordinal: number; status: string; passed: boolean; expectedOutput?: string; stdout?: string; stderr?: string }[];
	}

	let {
		loggedIn,
		program,
		onapply
	}: {
		loggedIn: boolean;
		program: Program;
		onapply: (name: string, params: string[]) => void;
	} = $props();

	let open = $state(false);
	let enabled = $state(true);
	let loading = $state(false);
	let problems = $state<Summary[]>([]);
	let detail = $state<Detail | null>(null);
	let lang = $state<'python' | 'javascript'>('python');
	let judging = $state(false);
	let result = $state<Verdict | null>(null);
	let msg = $state<string | null>(null);

	async function toggle() {
		open = !open;
		if (open && !problems.length) await loadList();
	}

	async function loadList() {
		loading = true; msg = null;
		try {
			const r = await fetch('/api/challenges');
			const d = await r.json();
			enabled = d.enabled;
			problems = d.problems ?? [];
		} catch { msg = 'No se pudo cargar la lista'; } finally { loading = false; }
	}

	async function openProblem(slug: string) {
		loading = true; result = null; msg = null;
		try {
			const r = await fetch(`/api/challenges?slug=${encodeURIComponent(slug)}`);
			const d = await r.json();
			detail = d.problem;
		} catch { msg = 'No se pudo cargar el reto'; } finally { loading = false; }
	}

	/** Extrae nombre y parámetros del starter de Python: `def nombre(a, b):`. */
	function applySignature() {
		if (!detail) return;
		const py = detail.starters?.python ?? '';
		const m = py.match(/def\s+(\w+)\s*\(([^)]*)\)/);
		if (!m) { msg = 'No pude leer la firma de la función'; return; }
		const name = m[1];
		const params = m[2].split(',').map((s) => s.trim()).filter(Boolean);
		onapply(name, params);
		msg = `Inicio configurado: ${name}(${params.join(', ')}). Arma el cuerpo y define la variable a retornar.`;
	}

	async function submit() {
		if (!detail) return;
		judging = true; result = null; msg = null;
		try {
			const source = generate(lang, program, get(functionRegistry));
			const r = await fetch('/api/judge', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ slug: detail.slug, language: lang, source })
			});
			if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error al juzgar');
			result = await r.json();
		} catch (e) { msg = e instanceof Error ? e.message : 'Error al juzgar'; } finally { judging = false; }
	}

	const accepted = $derived(result?.verdict === 'Accepted');
</script>

<div class="relative">
	<button
		onclick={toggle}
		class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
		title="Retos de Probator"
	>🏆 Retos</button>

	{#if open}
		<div data-panel class="absolute right-0 top-9 z-30 max-h-[80vh] w-96 overflow-auto rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
			{#if !enabled}
				<p class="text-xs text-zinc-500 dark:text-zinc-400">La integración con Probator no está configurada.</p>
			{:else if !detail}
				<div class="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Retos de Probator</div>
				{#if loading}
					<p class="text-xs text-zinc-400">Cargando…</p>
				{:else if problems.length === 0}
					<p class="text-xs text-zinc-400">No hay retos disponibles.</p>
				{:else}
					<ul class="space-y-1">
						{#each problems as p (p.slug)}
							<li>
								<button onclick={() => openProblem(p.slug)} class="flex w-full items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
									<span class="text-xs text-zinc-800 dark:text-zinc-100">{p.title}</span>
									<span class="rounded bg-zinc-200 px-1.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">{p.difficulty}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<button onclick={() => (detail = null)} class="mb-2 text-[11px] text-sky-600 hover:underline dark:text-sky-400">← volver a la lista</button>
				<div class="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{detail.title}</div>
				<pre class="my-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 text-[11px] text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{detail.statement}</pre>

				{#if detail.samples?.length}
					<div class="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Ejemplos</div>
					<div class="mb-2 space-y-1">
						{#each detail.samples as s, i (i)}
							<div class="flex gap-2 font-mono text-[11px]">
								<span class="rounded bg-zinc-100 px-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">in: {s.stdin.trim()}</span>
								<span class="rounded bg-emerald-50 px-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">out: {s.expectedOutput.trim()}</span>
							</div>
						{/each}
					</div>
				{/if}

				<button onclick={applySignature} class="mb-2 w-full rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-400">
					⚙ Configurar Inicio con esta firma
				</button>

				<div class="flex items-center gap-2">
					<select bind:value={lang} class="rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
						<option value="python">Python</option>
						<option value="javascript">JavaScript</option>
					</select>
					<button
						onclick={submit}
						disabled={judging || !loggedIn}
						title={loggedIn ? 'Genera el código y lo envía a Probator' : 'Inicia sesión para enviar'}
						class="flex-1 rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
					>{judging ? 'Juzgando…' : '▶ Enviar a Probator'}</button>
				</div>
				{#if !loggedIn}
					<p class="mt-1 text-[11px] text-zinc-500">Inicia sesión con Discord para enviar.</p>
				{/if}

				{#if result}
					<div class="mt-2 rounded border p-2 text-xs {accepted ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'}">
						<div class="font-semibold">{accepted ? '✓' : '✗'} {result.verdict} · {result.passedCount}/{result.totalCount}</div>
						{#if result.cases?.length}
							<div class="mt-1 flex flex-wrap gap-1">
								{#each result.cases as c (c.ordinal)}
									<span class="rounded px-1 text-[10px] {c.passed ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100' : 'bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100'}" title={c.stderr || c.status}>#{c.ordinal + 1}</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			{#if msg}<p class="mt-2 text-[11px] text-sky-600 dark:text-sky-300">{msg}</p>{/if}
		</div>
	{/if}
</div>
