<script lang="ts">
	import type { Program, Stmt } from '$lib/ir/ast';
	import { functionRegistry } from '$lib/dfd/functions';
	import { onMount } from 'svelte';

	interface SavedFn {
		id: number;
		name: string;
		params: string[];
		returnVar: string | null;
		body: Stmt[];
		updatedAt: string;
	}

	let {
		loggedIn,
		program,
		onload
	}: {
		loggedIn: boolean;
		program: Program;
		onload: (fn: { name: string; params: string[]; returnVar: string | null; body: Stmt[] }) => void;
	} = $props();

	let open = $state(false);
	let list = $state<SavedFn[]>([]);
	let loading = $state(false);
	let busy = $state(false);
	let msg = $state<string | null>(null);

	async function refresh() {
		loading = true;
		msg = null;
		try {
			const r = await fetch('/api/functions');
			if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error');
			list = await r.json();
			// Sincroniza el registro para la paleta (bloques custom) y codegen/intérprete.
			functionRegistry.set(
				list.map((f) => ({ name: f.name, params: f.params, returnVar: f.returnVar, body: f.body }))
			);
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Error cargando funciones';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (loggedIn) refresh();
	});

	function toggle() {
		open = !open;
		if (open && loggedIn) refresh();
	}

	async function saveCurrent() {
		busy = true;
		msg = null;
		try {
			const r = await fetch('/api/functions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: program.name,
					params: program.params ?? [],
					returnVar: program.returnVar ?? null,
					body: program.body
				})
			});
			if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error al guardar');
			msg = `Guardada «${program.name}»`;
			await refresh();
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Error al guardar';
		} finally {
			busy = false;
		}
	}

	function load(fn: SavedFn) {
		onload({ name: fn.name, params: fn.params, returnVar: fn.returnVar, body: fn.body });
		open = false;
	}

	async function del(fn: SavedFn) {
		if (!confirm(`¿Borrar la función «${fn.name}»?`)) return;
		busy = true;
		try {
			const r = await fetch(`/api/functions/${fn.id}`, { method: 'DELETE' });
			if (!r.ok) throw new Error('No se pudo borrar');
			await refresh();
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Error al borrar';
		} finally {
			busy = false;
		}
	}
</script>

<div class="relative">
	<button
		onclick={toggle}
		class="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
		title="Tus funciones guardadas"
	>
		📂 Mis funciones
	</button>

	{#if open}
		<div
			data-panel
			class="absolute right-0 top-9 z-30 w-72 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
		>
			{#if !loggedIn}
				<p class="text-xs text-zinc-500 dark:text-zinc-400">
					Entra con Discord para guardar y cargar tus funciones.
				</p>
			{:else}
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Mis funciones</span>
					<button
						onclick={saveCurrent}
						disabled={busy}
						class="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
						title="Guarda el algoritmo actual con su nombre"
					>
						💾 Guardar «{program.name}»
					</button>
				</div>

				{#if msg}
					<p class="mb-2 text-[11px] text-sky-600 dark:text-sky-300">{msg}</p>
				{/if}

				{#if loading}
					<p class="text-xs text-zinc-400">Cargando…</p>
				{:else if list.length === 0}
					<p class="text-xs text-zinc-400">Aún no tienes funciones guardadas.</p>
				{:else}
					<ul class="max-h-72 space-y-1 overflow-auto">
						{#each list as fn (fn.id)}
							<li class="flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-800">
								<div class="min-w-0 flex-1">
									<div class="truncate font-mono text-xs text-zinc-800 dark:text-zinc-100">
										{fn.name}({fn.params.join(', ')}){fn.returnVar ? ` → ${fn.returnVar}` : ''}
									</div>
								</div>
								<button
									onclick={() => load(fn)}
									class="rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
									title="Cargar en el lienzo"
								>Cargar</button>
								<button
									onclick={() => del(fn)}
									disabled={busy}
									class="rounded border border-rose-300 px-1.5 py-0.5 text-[11px] text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
									title="Borrar"
								>✕</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}
</div>
