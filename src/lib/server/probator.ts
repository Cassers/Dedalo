import { env } from '$env/dynamic/private';

/**
 * Cliente del API de Probator (integración OPT-IN). Si no hay PROBATOR_API_URL +
 * PROBATOR_API_KEY, todo devuelve "no disponible" y la UI oculta los controles —
 * Dédalo sigue 100% funcional (autosuficiente). Toda llamada va con timeout y
 * try/catch: si Probator no responde, degradamos sin romper.
 */
function base(): string {
	return (env.PROBATOR_API_URL || '').replace(/\/$/, '');
}
function key(): string {
	return env.PROBATOR_API_KEY || '';
}
export function probatorEnabled(): boolean {
	return !!(base() && key());
}

async function api(path: string, init?: RequestInit): Promise<unknown | null> {
	if (!probatorEnabled()) return null;
	try {
		const res = await fetch(`${base()}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${key()}`,
				'Content-Type': 'application/json',
				...(init?.headers ?? {})
			},
			signal: AbortSignal.timeout(20000)
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null; // Probator caído / timeout → degradación elegante
	}
}

export interface ProblemSummary {
	id: number;
	slug: string;
	title: string;
	difficulty: string;
	mode: string;
}
export interface ProblemDetail extends ProblemSummary {
	statement: string;
	languages: string[];
	starters: Record<string, string>;
	samples: { ordinal: number; stdin: string; expectedOutput: string }[];
}
export interface JudgeCase {
	ordinal: number;
	isSample: boolean;
	status: string;
	passed: boolean;
	stdin?: string;
	expectedOutput?: string;
	stdout?: string;
	stderr?: string;
}
export interface JudgeResult {
	submissionId: number;
	verdict: string;
	passedCount: number;
	totalCount: number;
	runtimeMs?: number;
	compileOutput?: string | null;
	cases?: JudgeCase[];
}

export async function listProblems(): Promise<ProblemSummary[]> {
	const r = (await api('/api/v1/problems')) as { problems?: ProblemSummary[] } | null;
	return r?.problems ?? [];
}

export async function getProblem(slug: string): Promise<ProblemDetail | null> {
	return (await api(`/api/v1/problems/${encodeURIComponent(slug)}`)) as ProblemDetail | null;
}

export async function judge(body: {
	slug: string;
	language: string;
	source: string;
	discordId?: string;
	username?: string;
}): Promise<JudgeResult | null> {
	return (await api('/api/v1/submit', {
		method: 'POST',
		body: JSON.stringify(body)
	})) as JudgeResult | null;
}
