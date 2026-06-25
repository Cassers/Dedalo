import { json, error } from '@sveltejs/kit';
import { judge, probatorEnabled } from '$lib/server/probator';
import type { RequestHandler } from './$types';

/** POST /api/judge — envía el código generado a Probator para juzgarlo.
 *  Body: { slug, language, source }. Adjunta el discordId del usuario logueado
 *  (atribución de la entrega) y reenvía con la API key (que nunca sale al cliente). */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!probatorEnabled()) throw error(503, 'La integración con Probator no está configurada');
	const b = (await request.json().catch(() => null)) as
		| { slug?: string; language?: string; source?: string }
		| null;
	if (!b?.slug || !b.language || b.source == null) throw error(400, 'Faltan campos: slug, language, source');

	const result = await judge({
		slug: b.slug,
		language: b.language,
		source: b.source,
		discordId: locals.user?.discordId,
		username: locals.user?.username
	});
	if (!result) throw error(502, 'Probator no respondió');
	return json(result);
};
