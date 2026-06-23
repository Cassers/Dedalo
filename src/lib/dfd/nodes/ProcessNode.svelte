<script lang="ts">
	import Ports from './Ports.svelte';
	import { activeStmtId } from '../active';
	let { data, selected }: { data: { label: string; stmtId?: string }; selected?: boolean } = $props();
	const active = $derived($activeStmtId != null && $activeStmtId === data.stmtId);
</script>

<div
	class="flex h-[60px] w-[184px] items-center justify-center rounded-md border-2 px-3 text-center font-mono text-xs transition-shadow
		{active ? 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_18px_2px_rgba(251,191,36,0.55)]'
		: selected ? 'border-sky-400 bg-zinc-800 text-zinc-100'
		: 'border-zinc-600 bg-zinc-800 text-zinc-100'}"
>
	<Ports />
	{data.label}
</div>
