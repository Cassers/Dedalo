<script lang="ts">
	import Ports from './Ports.svelte';
	import { activeStmtId } from '../active';
	let { data, selected }: { data: { label: string; stmtId?: string }; selected?: boolean } = $props();
	const active = $derived($activeStmtId != null && $activeStmtId === data.stmtId);
</script>

<!-- Paralelogramo (entrada/salida): se inclina el contenedor y se endereza el texto. -->
<div class="relative h-[60px] w-[184px]">
	<Ports />
	<div
		class="absolute inset-0 -skew-x-12 rounded-sm border-2 transition-shadow
			{active ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_18px_2px_rgba(251,191,36,0.55)]'
			: selected ? 'border-sky-400 bg-violet-900/40'
			: 'border-violet-500 bg-violet-900/40'}"
	></div>
	<div class="absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-xs text-violet-100">
		{data.label}
	</div>
</div>
