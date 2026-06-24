import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// dynamic/private: DATABASE_URL se lee en runtime (env de Docker/host), no se hornea.
const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
export { schema };
