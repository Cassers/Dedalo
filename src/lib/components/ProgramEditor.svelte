<script lang="ts">
	import type { Program } from '$lib/ir/ast';

	let {
		program,
		role,
		onchange,
		onclose
	}: {
		program: Program;
		role: 'start' | 'end';
		onchange: () => void;
		onclose: () => void;
	} = $props();

	const lbl = 'mb-1 text-[10px] uppercase tracking-wide text-zinc-500';
	const inp =
		'w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-900 focus:border-sky-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

	function setParams(value: string) {
		program.params = value.split(',').map((x) => x.trim()).filter(Boolean);
		onchange();
	}
</script>

<div class="mb-2 flex items-center justify-between">
	<span class="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
		{role === 'start' ? 'Inicio · función' : 'Fin · retorno'}
	</span>
	<button class="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200" onclick={onclose} title="cerrar">✕</button>
</div>

<div class="flex flex-col gap-2">
	{#if role === 'start'}
		<div>
			<div class={lbl}>Nombre de la función</div>
			<input
				class={inp}
				value={program.name}
				placeholder="main"
				onchange={(e) => { program.name = (e.target as HTMLInputElement).value.trim() || 'main'; onchange(); }}
			/>
		</div>
		<div>
			<div class={lbl}>Parámetros (separados por coma)</div>
			<input
				class={inp}
				value={(program.params ?? []).join(', ')}
				placeholder="a, b, n"
				onchange={(e) => setParams((e.target as HTMLInputElement).value)}
			/>
			<p class="mt-1 text-[10px] text-zinc-500">Al correr se te pedirá un valor para cada parámetro.</p>
		</div>
	{:else}
		<div>
			<div class={lbl}>Variable a devolver</div>
			<input
				class={inp}
				value={program.returnVar ?? ''}
				placeholder="(nada — déjalo vacío)"
				onchange={(e) => { const v = (e.target as HTMLInputElement).value.trim(); program.returnVar = v || undefined; onchange(); }}
			/>
			<p class="mt-1 text-[10px] text-zinc-500">Vacío = la función no devuelve nada.</p>
		</div>
	{/if}
</div>
