import { writable } from 'svelte/store';
import type { FnDef } from '$lib/ir/ast';

/**
 * Registro de funciones guardadas del usuario, disponible para: la paleta
 * (bloques custom), el codegen (emitir definiciones) y el intérprete (ejecutar
 * las llamadas). Lo llena `+page` al cargar y `FunctionsMenu` tras guardar/borrar.
 */
export const functionRegistry = writable<FnDef[]>([]);
