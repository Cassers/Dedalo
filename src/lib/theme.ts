import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'auto';

const KEY = 'dedalo:theme';
const initial: Theme = (browser && (localStorage.getItem(KEY) as Theme)) || 'auto';

/** Preferencia del usuario: claro / oscuro / automático. */
export const theme = writable<Theme>(initial);
/** Si el tema efectivo (resuelto) es oscuro — para colorear el SVG. */
export const isDark = writable<boolean>(true);

let current: Theme = initial;
const mq = browser ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply(t: Theme) {
	if (!browser) return;
	const dark = t === 'dark' || (t === 'auto' && !!mq?.matches);
	document.documentElement.classList.toggle('dark', dark);
	isDark.set(dark);
}

theme.subscribe((t) => {
	current = t;
	if (browser) {
		localStorage.setItem(KEY, t);
		apply(t);
	}
});

// En modo automático, seguir los cambios del sistema.
mq?.addEventListener('change', () => apply(current));
