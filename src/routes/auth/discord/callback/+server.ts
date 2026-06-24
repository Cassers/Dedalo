import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { exchangeCode, fetchDiscordUser, isGuildMember } from '$lib/server/discord';
import { SESSION_COOKIE, makeSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get('dedalo_oauth_state');
	cookies.delete('dedalo_oauth_state', { path: '/' });

	if (!code || !state || state !== expectedState) {
		throw redirect(303, '/?auth=error');
	}

	const redirectUri = `${url.origin}/auth/discord/callback`;
	let dUser;
	try {
		const token = await exchangeCode(code, redirectUri);
		if (!(await isGuildMember(token))) throw redirect(303, '/?auth=not_member');
		dUser = await fetchDiscordUser(token);
	} catch (e) {
		// Re-lanza redirects de SvelteKit; lo demás = error de auth.
		if (e instanceof Response || (e as { status?: number })?.status === 303) throw e;
		console.error('[auth/discord] callback error', e);
		throw redirect(303, '/?auth=error');
	}

	// Upsert del usuario por id de Discord.
	const values = {
		discordId: dUser.id,
		username: dUser.username,
		displayName: dUser.global_name ?? null,
		avatar: dUser.avatar ?? null,
		lastLoginAt: new Date()
	};
	const [row] = await db
		.insert(users)
		.values(values)
		.onConflictDoUpdate({
			target: users.discordId,
			set: {
				username: values.username,
				displayName: values.displayName,
				avatar: values.avatar,
				lastLoginAt: values.lastLoginAt
			}
		})
		.returning({ id: users.id });

	cookies.set(SESSION_COOKIE, makeSession(row.id), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 30
	});

	const next = cookies.get('dedalo_oauth_next');
	cookies.delete('dedalo_oauth_next', { path: '/' });
	throw redirect(303, next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
};
