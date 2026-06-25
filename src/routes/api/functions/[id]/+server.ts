import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { functions } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** DELETE /api/functions/[id] — borra una función del usuario (solo dueño). */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'No autorizado');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'id inválido');
	const [row] = await db
		.delete(functions)
		.where(and(eq(functions.id, id), eq(functions.userId, locals.user.id)))
		.returning({ id: functions.id });
	if (!row) throw error(404, 'Función no encontrada');
	return json({ ok: true });
};
