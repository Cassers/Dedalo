import { json, error } from '@sveltejs/kit';
import { eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { functions } from '$lib/server/db/schema';
import type { Stmt } from '$lib/ir/ast';
import type { RequestHandler } from './$types';

/** GET /api/functions — lista las funciones del usuario logueado. */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Inicia sesión para ver tus funciones');
	const rows = await db
		.select()
		.from(functions)
		.where(eq(functions.userId, locals.user.id))
		.orderBy(desc(functions.updatedAt));
	return json(rows);
};

interface SaveBody {
	name?: string;
	params?: string[];
	returnVar?: string | null;
	body?: Stmt[];
}

/** POST /api/functions — guarda (crea o actualiza por nombre) la función actual. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) throw error(401, 'Inicia sesión para guardar funciones');
	const b = (await request.json().catch(() => null)) as SaveBody | null;
	if (!b || !b.name || !b.name.trim()) throw error(400, 'Falta el nombre de la función');

	const values = {
		userId: locals.user.id,
		name: b.name.trim(),
		params: Array.isArray(b.params) ? b.params : [],
		returnVar: b.returnVar ? b.returnVar : null,
		body: Array.isArray(b.body) ? b.body : [],
		updatedAt: new Date()
	};

	const [row] = await db
		.insert(functions)
		.values(values)
		.onConflictDoUpdate({
			target: [functions.userId, functions.name],
			set: {
				params: values.params,
				returnVar: values.returnVar,
				body: values.body,
				updatedAt: values.updatedAt
			}
		})
		.returning();

	return json(row);
};
