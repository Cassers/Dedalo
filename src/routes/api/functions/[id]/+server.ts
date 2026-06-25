import { json, error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { functions } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** PATCH /api/functions/[id] — actualiza metadatos ligeros (carpeta) sin reenviar
 *  el body. `folder: null | ''` = quitar de carpeta. Solo el dueño. */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) throw error(401, 'No autorizado');
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'id inválido');
	const b = (await request.json().catch(() => null)) as { folder?: string | null } | null;
	if (!b || !('folder' in b)) throw error(400, 'Nada que actualizar');
	const folder = b.folder && b.folder.trim() ? b.folder.trim() : null;
	const [row] = await db
		.update(functions)
		.set({ folder, updatedAt: new Date() })
		.where(and(eq(functions.id, id), eq(functions.userId, locals.user.id)))
		.returning();
	if (!row) throw error(404, 'Función no encontrada');
	return json(row);
};

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
