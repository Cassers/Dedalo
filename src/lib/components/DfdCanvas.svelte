<script lang="ts">
	import { SvelteFlow, Background, Controls, type NodeTypes } from '@xyflow/svelte';
	import type { Program } from '$lib/ir/ast';
	import { buildGraph } from '$lib/dfd/layout';
	import { selectedStmtId } from '$lib/dfd/active';
	import TerminalNode from '$lib/dfd/nodes/TerminalNode.svelte';
	import ProcessNode from '$lib/dfd/nodes/ProcessNode.svelte';
	import IoNode from '$lib/dfd/nodes/IoNode.svelte';
	import DecisionNode from '$lib/dfd/nodes/DecisionNode.svelte';
	import MergeNode from '$lib/dfd/nodes/MergeNode.svelte';

	let { program }: { program: Program } = $props();

	const nodeTypes = {
		terminal: TerminalNode,
		process: ProcessNode,
		io: IoNode,
		decision: DecisionNode,
		merge: MergeNode
	} as unknown as NodeTypes;

	// El grafo se DERIVA del AST: cada cambio del programa lo recalcula.
	let nodes = $state.raw<ReturnType<typeof buildGraph>['nodes']>([]);
	let edges = $state.raw<ReturnType<typeof buildGraph>['edges']>([]);

	$effect(() => {
		const g = buildGraph(program.body);
		nodes = g.nodes;
		edges = g.edges;
	});

	const onnodeclick = ({ node }: { node: { data: Record<string, unknown> } }) => {
		const id = (node.data.stmtId as string | undefined) ?? null;
		selectedStmtId.set(id);
	};
</script>

<div class="h-full w-full">
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{onnodeclick}
		fitView
		nodesDraggable={false}
		nodesConnectable={false}
		elementsSelectable
		proOptions={{ hideAttribution: true }}
		minZoom={0.2}
	>
		<Background gap={22} bgColor="#09090b" patternColor="#1f1f23" />
		<Controls showLock={false} />
	</SvelteFlow>
</div>
