import type { Handle } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE, readSession } from '$lib/server/session';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

export const handle: Handle = async ({ event, resolve }) => {
	// Resuelve el usuario logueado (sesión Discord) en event.locals.user.
	event.locals.user = null;
	const uid = readSession(event.cookies.get(SESSION_COOKIE));
	if (uid != null) {
		const [u] = await db
			.select({
				id: users.id,
				discordId: users.discordId,
				username: users.username,
				displayName: users.displayName,
				avatar: users.avatar,
				role: users.role
			})
			.from(users)
			.where(eq(users.id, uid))
			.limit(1);
		if (u) event.locals.user = u;
	}

	return resolve(event);
};
