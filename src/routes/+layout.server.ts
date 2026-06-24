import { discordEnabled } from '$lib/server/discord';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		discordEnabled: discordEnabled()
	};
};
