import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// El adapter, preprocess y demás config de SvelteKit viven en svelte.config.js.
// @xyflow/svelte (publica .svelte con TS) se prebundlea bien gracias a
// vitePreprocess({ script: true }) en svelte.config.js.
export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});
