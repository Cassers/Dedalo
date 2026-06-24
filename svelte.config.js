import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// script:true fuerza la transpilación TS con esbuild. Sin esto, Svelte 5 usa su
	// stripper nativo que deja el `?` de parámetros opcionales (rompe @xyflow/svelte).
	// Svelte 5 activa runes por archivo automáticamente, así que no forzamos `runes` global.
	preprocess: vitePreprocess({ script: true }),
	kit: {
		// adapter-node: ahora hay backend (auth Discord, BD, API). La página del editor
		// sigue siendo client-side (ssr=false en +page.ts); hooks/endpoints corren en server.
		adapter: adapter()
	}
};

export default config;
