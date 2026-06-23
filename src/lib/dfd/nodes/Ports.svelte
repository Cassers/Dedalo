<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	// Puertos comunes a todos los símbolos. Quedan casi invisibles porque las
	// posiciones del diagrama son fijas; sólo sirven de anclas para los edges.
	let { decision = false }: { decision?: boolean } = $props();
	const cls = 'opacity-0';
</script>

<Handle type="target" position={Position.Top} id="in" class={cls} />
<Handle type="target" position={Position.Left} id="back" class={cls} />
<Handle type="source" position={Position.Bottom} id="out" class={cls} />
<Handle type="source" position={Position.Right} id="alt" class={cls} />
{#if decision}{/if}
