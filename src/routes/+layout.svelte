<script lang="ts">
	import '../app.css';
	import '$lib/theme'; // aplica el tema (claro/oscuro/auto) al cargar
	let { children } = $props();
</script>

{@render children()}
