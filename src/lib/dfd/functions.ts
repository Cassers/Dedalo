import { writable } from 'svelte/store';
import type { FnDef } from '$lib/ir/ast';

/** Una función del registro = su definición (FnDef) + metadatos de organización
 *  (carpeta). El `folder` es solo para agrupar en la UI; codegen/intérprete lo
 *  ignoran (FnDef es asignable). */
export type RegisteredFn = FnDef & { folder?: string | null };

/**
 * Registro de funciones guardadas del usuario, disponible para: la paleta
 * (bloques custom), el codegen (emitir definiciones) y el intérprete (ejecutar
 * las llamadas). Lo llena `+page` al cargar y `FunctionsMenu` tras guardar/borrar.
 */
export const functionRegistry = writable<RegisteredFn[]>([]);
