import { json } from '@sveltejs/kit';
import { listProblems, getProblem, probatorEnabled } from '$lib/server/probator';
import type { RequestHandler } from './$types';

/** GET /api/challenges        → lista de retos de Probator (o [] si no disponible).
 *  GET /api/challenges?slug=x  → detalle de un reto (statement, samples, starters). */
export const GET: RequestHandler = async ({ url }) => {
	if (!probatorEnabled()) return json({ enabled: false, problems: [] });
	const slug = url.searchParams.get('slug');
	if (slug) {
		const detail = await getProblem(slug);
		return json({ enabled: true, problem: detail });
	}
	return json({ enabled: true, problems: await listProblems() });
};
