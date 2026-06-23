<script lang="ts">
	import Ports from './Ports.svelte';
	let { data }: { data: { label: string; variant?: 'inicio' | 'fin' } } = $props();
	const color = $derived(
		data.variant === 'fin' ? 'border-rose-600 bg-rose-950/50 text-rose-200' : 'border-emerald-600 bg-emerald-950/50 text-emerald-200'
	);
</script>

<div
	class="flex h-[60px] w-[184px] items-center justify-center rounded-full border-2 text-sm font-semibold {color}"
>
	<Ports />
	{data.label}
</div>
