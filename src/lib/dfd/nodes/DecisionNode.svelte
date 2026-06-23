<script lang="ts">
	import Ports from './Ports.svelte';
	import { activeStmtId } from '../active';
	let { data, selected }: { data: { label: string; stmtId?: string }; selected?: boolean } = $props();
	const active = $derived($activeStmtId != null && $activeStmtId === data.stmtId);
	const stroke = $derived(active ? '#fbbf24' : selected ? '#38bdf8' : '#f59e0b');
	const fill = $derived(active ? 'rgba(251,191,36,0.18)' : 'rgba(120,53,15,0.45)');
</script>

<!-- Rombo de decisión: SVG que llena la caja del nodo. -->
<div class="relative h-[60px] w-[184px]" class:drop-shadow-[0_0_14px_rgba(251,191,36,0.55)]={active}>
	<Ports decision />
	<svg viewBox="0 0 184 60" class="absolute inset-0 h-full w-full">
		<polygon points="92,2 182,30 92,58 2,30" fill={fill} stroke={stroke} stroke-width="2" />
	</svg>
	<div class="absolute inset-0 flex items-center justify-center px-8 text-center font-mono text-xs text-amber-100">
		{data.label}
	</div>
</div>
