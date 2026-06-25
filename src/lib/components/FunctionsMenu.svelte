<script lang="ts">
	import type { Program, Stmt } from '$lib/ir/ast';
	import { functionRegistry } from '$lib/dfd/functions';
	import { onMount } from 'svelte';

	interface SavedFn {
		id: number;
		name: string;
		params: string[];
		returnVar: string | null;
		folder: string | null;
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

	// --- Carpetas (organización) ---
	const SIN = ''; // clave de "sin carpeta"
	let extraFolders = $state<string[]>([]); // carpetas creadas pero aún vacías
	let dragId = $state<number | null>(null); // función que se arrastra
	let overFolder = $state<string | null>(null); // carpeta resaltada al arrastrar encima

	/** Agrupa las funciones por carpeta: carpetas con nombre (orden alfabético)
	 *  primero, "sin carpeta" al final. Incluye las carpetas vacías recién creadas. */
	const groups = $derived.by(() => {
		const map = new Map<string, SavedFn[]>();
		for (const f of extraFolders) if (f) map.set(f, map.get(f) ?? []);
		for (const fn of list) {
			const k = fn.folder ?? SIN;
			if (!map.has(k)) map.set(k, []);
			map.get(k)!.push(fn);
		}
		const named = [...map.keys()].filter((k) => k !== SIN).sort((a, b) => a.localeCompare(b));
		const out: Array<[string, SavedFn[]]> = named.map((n) => [n, map.get(n)!]);
		if (map.has(SIN)) out.push([SIN, map.get(SIN)!]);
		return out;
	});

	async function refresh() {
		loading = true;
		msg = null;
		try {
			const r = await fetch('/api/functions');
			if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error');
			list = await r.json();
			// Sincroniza el registro para la paleta (bloques custom) y codegen/intérprete.
			functionRegistry.set(
				list.map((f) => ({ name: f.name, params: f.params, returnVar: f.returnVar, folder: f.folder, body: f.body }))
			);
			// Olvida las carpetas vacías que ya tienen funciones reales.
			extraFolders = extraFolders.filter((f) => !list.some((x) => x.folder === f));
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

	function newFolder() {
		const name = prompt('Nombre de la carpeta')?.trim();
		if (!name) return;
		if (![...extraFolders, ...list.map((f) => f.folder)].includes(name)) {
			extraFolders = [...extraFolders, name];
		}
	}

	/** Mueve una función a una carpeta (null = sacarla). Sólo cambia el metadato. */
	async function moveToFolder(id: number, folder: string | null) {
		busy = true;
		msg = null;
		try {
			const r = await fetch(`/api/functions/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folder })
			});
			if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'No se pudo mover');
			await refresh();
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Error al mover';
		} finally {
			busy = false;
		}
	}

	// --- Drag de funciones hacia carpetas (DnD nativo, independiente del lienzo) ---
	function onFnDragStart(e: DragEvent, id: number) {
		dragId = id;
		e.dataTransfer?.setData('text/plain', String(id));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function onFolderOver(e: DragEvent, folder: string) {
		if (dragId == null) return;
		e.preventDefault();
		overFolder = folder;
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}
	function onFolderDrop(e: DragEvent, folder: string) {
		e.preventDefault();
		const id = dragId;
		dragId = null;
		overFolder = null;
		if (id != null) moveToFolder(id, folder === SIN ? null : folder);
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
				<div class="mb-2 flex items-center justify-between gap-2">
					<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Mis funciones</span>
					<div class="flex items-center gap-1.5">
						<button
							onclick={newFolder}
							class="rounded border border-zinc-300 px-1.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
							title="Crear una carpeta"
						>📁＋</button>
						<button
							onclick={saveCurrent}
							disabled={busy}
							class="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
							title="Guarda el algoritmo actual con su nombre"
						>
							💾 Guardar «{program.name}»
						</button>
					</div>
				</div>

				{#if msg}
					<p class="mb-2 text-[11px] text-sky-600 dark:text-sky-300">{msg}</p>
				{/if}

				{#if loading}
					<p class="text-xs text-zinc-400">Cargando…</p>
				{:else if list.length === 0}
					<p class="text-xs text-zinc-400">Aún no tienes funciones guardadas.</p>
				{:else}
					<p class="mb-1 text-[10px] text-zinc-400">Arrastra una función a una carpeta para organizarla.</p>
					<div class="max-h-72 space-y-2 overflow-auto">
						{#each groups as [folder, fns] (folder)}
							<div
								role="group"
								ondragover={(e) => onFolderOver(e, folder)}
								ondragleave={() => { if (overFolder === folder) overFolder = null; }}
								ondrop={(e) => onFolderDrop(e, folder)}
								class="rounded-md border border-dashed px-1.5 py-1 transition-colors {overFolder === folder
									? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
									: 'border-transparent'}"
							>
								<div class="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
									{folder === SIN ? '— sin carpeta —' : `📁 ${folder}`}
								</div>
								{#if fns.length === 0}
									<p class="px-0.5 py-1 text-[10px] italic text-zinc-400">vacía · suelta una función aquí</p>
								{/if}
								<ul class="space-y-1">
									{#each fns as fn (fn.id)}
										<li
											draggable="true"
											ondragstart={(e) => onFnDragStart(e, fn.id)}
											ondragend={() => { dragId = null; overFolder = null; }}
											class="flex cursor-grab items-center gap-2 rounded border border-zinc-200 px-2 py-1 active:cursor-grabbing dark:border-zinc-800"
										>
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
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
