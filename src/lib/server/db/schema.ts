import {
	pgTable,
	serial,
	text,
	timestamp,
	integer,
	boolean,
	jsonb,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import type { Stmt } from '$lib/ir/ast';

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

/**
 * Una función/algoritmo guardado por un usuario. `body` es el AST (program.body)
 * serializado como JSON (datos puros, JSON-safe). Sirve para recargarla en el
 * editor y, en Fase 4, para usarla como bloque custom (CallFn). Único por
 * (userId, name): "guardar" = crear-o-actualizar por nombre.
 */
export const functions = pgTable(
	'functions',
	{
		id: serial('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		params: jsonb('params').$type<string[]>().notNull().default([]),
		returnVar: text('return_var'), // null = no devuelve nada
		body: jsonb('body').$type<Stmt[]>().notNull().default([]),
		isPublic: boolean('is_public').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('functions_user_idx').on(t.userId),
		uniqueIndex('functions_user_name_idx').on(t.userId, t.name)
	]
);

export type User = typeof users.$inferSelect;
export type DedaloFunction = typeof functions.$inferSelect;
