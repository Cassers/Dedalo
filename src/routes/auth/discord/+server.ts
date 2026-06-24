import { error, redirect } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { discordEnabled, authorizeUrl } from '$lib/server/discord';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!discordEnabled()) throw error(503, 'Login con Discord no está configurado');
	const state = randomBytes(16).toString('hex');
	const opts = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: url.protocol === 'https:',
		maxAge: 600
	};
	cookies.set('dedalo_oauth_state', state, opts);
	// Recuerda a dónde volver tras el login (solo rutas locales).
	const next = url.searchParams.get('next');
	if (next && next.startsWith('/') && !next.startsWith('//')) {
		cookies.set('dedalo_oauth_next', next, opts);
	}
	const redirectUri = `${url.origin}/auth/discord/callback`;
	throw redirect(302, authorizeUrl(redirectUri, state));
};
