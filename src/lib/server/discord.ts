import { env } from '$env/dynamic/private';

/**
 * Discord OAuth2 (authorization-code flow). Configurado por env, igual que
 * Probator: usar la MISMA app de Discord en ambos proyectos da identidad
 * compartida. Login oculto si faltan DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET.
 *
 * Opcional: DISCORD_GUILD_ID exige pertenecer a un servidor. Dédalo es abierto,
 * así que normalmente se deja sin guild gate (cualquiera con Discord entra).
 */
export interface DiscordUser {
	id: string;
	username: string;
	global_name: string | null;
	avatar: string | null;
}

export function discordEnabled(): boolean {
	return !!(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

export function authorizeUrl(redirectUri: string, state: string): string {
	const scope = env.DISCORD_GUILD_ID ? 'identify guilds' : 'identify';
	const p = new URLSearchParams({
		client_id: env.DISCORD_CLIENT_ID as string,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope,
		state
	});
	return `https://discord.com/oauth2/authorize?${p.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
	const body = new URLSearchParams({
		client_id: env.DISCORD_CLIENT_ID as string,
		client_secret: env.DISCORD_CLIENT_SECRET as string,
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri
	});
	const res = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
	const res = await fetch('https://discord.com/api/users/@me', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);
	return (await res.json()) as DiscordUser;
}

/** True si el usuario está en DISCORD_GUILD_ID (o si no hay guild gate configurado). */
export async function isGuildMember(accessToken: string): Promise<boolean> {
	const gid = env.DISCORD_GUILD_ID;
	if (!gid) return true;
	const res = await fetch('https://discord.com/api/users/@me/guilds', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) return false;
	const guilds = (await res.json()) as { id: string }[];
	return guilds.some((g) => g.id === gid);
}
