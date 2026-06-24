import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Esquema de Dédalo. BD propia (separada de Probator) pero la tabla `users` es
 * idéntica a la de Probator: identidad por `discordId` con la MISMA app de
 * Discord ⇒ el mismo usuario se reconoce en ambos proyectos (SSO-lite) y las
 * entregas a Probator se atribuyen por `discordId`.
 */
export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	discordId: text('discord_id').notNull().unique(),
	username: text('username').notNull(), // Discord username
	displayName: text('display_name'), // Discord global_name
	avatar: text('avatar'), // Discord avatar hash
	role: text('role').notNull().default('student'), // student | admin
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow()
});

export type User = typeof users.$inferSelect;
