<script lang="ts">
	import { BLOCKS } from '$lib/dfd/blockmeta';
	import { dragging } from '$lib/dnd';
	import { functionRegistry } from '$lib/dfd/functions';

	function onDragStart(e: DragEvent, kind: (typeof BLOCKS)[number]['kind']) {
		dragging.set({ type: 'new', kind });
		e.dataTransfer?.setData('text/plain', kind);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
	}
	function onFnDragStart(e: DragEvent, fnName: string) {
		dragging.set({ type: 'newfn', fnName });
		e.dataTransfer?.setData('text/plain', fnName);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
	}
	function onDragEnd() {
		dragging.set(null);
	}
</script>

<div class="flex flex-col gap-2 p-3">
	<p class="text-[11px] text-zinc-500">Arrastra un bloque al lienzo →</p>
	{#each BLOCKS as b (b.kind)}
		<div
			role="button"
			tabindex="0"
			draggable="true"
			ondragstart={(e) => onDragStart(e, b.kind)}
			ondragend={onDragEnd}
			class="cursor-grab rounded-lg border-2 bg-white px-3 py-2 text-sm font-medium active:cursor-grabbing dark:bg-zinc-900 {b.chip}"
		>
			{#if b.shape === 'decision'}◇{:else if b.shape === 'io'}▱{:else if b.shape === 'loop'}↻{:else}▭{/if}
			{b.label}
		</div>
	{/each}

	{#if $functionRegistry.length}
		<p class="mt-2 border-t border-zinc-200 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800">Mis funciones</p>
		{#each $functionRegistry as fn (fn.name)}
			<div
				role="button"
				tabindex="0"
				draggable="true"
				ondragstart={(e) => onFnDragStart(e, fn.name)}
				ondragend={onDragEnd}
				title="Arrastra para usar {fn.name}(…) como bloque"
				class="cursor-grab rounded-lg border-2 border-teal-500 bg-white px-3 py-2 text-sm font-medium text-teal-700 active:cursor-grabbing dark:bg-zinc-900 dark:text-teal-300"
			>
				⊟ {fn.name}({fn.params.join(', ')})
			</div>
		{/each}
	{/if}
</div>
