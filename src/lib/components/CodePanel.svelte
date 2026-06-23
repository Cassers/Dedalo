<script lang="ts">
	import type { Program } from '$lib/ir/ast';
	import { generate, TARGETS, type TargetLang } from '$lib/codegen';

	let { program }: { program: Program } = $props();
	let lang = $state<TargetLang>('python');

	const code = $derived.by(() => {
		try {
			return generate(lang, program);
		} catch {
			return '// (no se pudo generar — revisa el diagrama)';
		}
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
		} catch {
			/* sin clipboard */
		}
	}
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center gap-1 border-b border-zinc-800 px-2 py-1.5">
		{#each TARGETS as t (t.key)}
			<button
				class="rounded px-2 py-1 text-xs {lang === t.key ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}"
				onclick={() => (lang = t.key)}
			>
				{t.label}
			</button>
		{/each}
		<button class="ml-auto rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800" onclick={copy}>
			copiar
		</button>
	</div>
	<pre class="flex-1 overflow-auto bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200">{code}</pre>
</div>
