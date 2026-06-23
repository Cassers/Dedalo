import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// script:true fuerza la transpilación TS con esbuild. Sin esto, Svelte 5 usa su
	// stripper nativo que deja el `?` de parámetros opcionales (rompe @xyflow/svelte).
	// Svelte 5 activa runes por archivo automáticamente, así que no forzamos `runes` global.
	preprocess: vitePreprocess({ script: true }),
	kit: {
		// SPA estática: sin backend en el MVP (todo corre en el navegador).
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
