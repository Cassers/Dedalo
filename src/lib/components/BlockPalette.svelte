<script lang="ts">
	import { BLOCKS } from '$lib/dfd/blockmeta';
	import { dragging } from '$lib/dnd';

	function onDragStart(e: DragEvent, kind: (typeof BLOCKS)[number]['kind']) {
		dragging.set({ type: 'new', kind });
		e.dataTransfer?.setData('text/plain', kind);
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
</div>
