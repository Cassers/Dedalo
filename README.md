# Dédalo

**Programa con diagramas de flujo.** Entorno tipo videojuego para aprender algoritmia:
arma un algoritmo con los **símbolos clásicos de DFD** (inicio/fin, proceso, entrada-salida,
decisión, ciclos), míralo traducido **en vivo a código nativo** (pseudocódigo, Python,
JavaScript) y **córrelo paso a paso** viendo cómo se ilumina cada símbolo.

Pensado para el curso de algoritmia de Sergio (relacionado con Probator / Discamus). OSS, MIT.

## Cómo correrlo

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # SPA estática en build/ (adapter-static)
pnpm check    # type-check con svelte-check
```

> Siempre **pnpm**, nunca npm (seguridad supply-chain).

## Qué hace (MVP)

- **Editor de diagrama** (Svelte Flow): símbolos DFD con ramas Sí/No y back-edges de ciclos.
  El diagrama se **deriva** de un AST estructurado (los nodos no se arrastran libremente).
- **Construcción** desde un esquema editable (panel izquierdo): agregar/editar/borrar/mover
  sentencias, con expresiones escritas en texto (`a + b`, `n % 2 == 0`, `raiz(x)`).
- **Código en vivo** (panel derecho): el mismo algoritmo en Pseudocódigo / Python / JavaScript,
  actualizándose con cada cambio.
- **Ejecución en el navegador**: intérprete del AST con Correr / Paso / Pausa / Reiniciar,
  resaltado del nodo activo, consola de salida y tabla de variables. Sin servidor.

## Arquitectura

El **AST estructurado** (`src/lib/ir/ast.ts`) es el hub: todo deriva de él.

| Pieza | Ruta | Qué hace |
|------|------|----------|
| IR / AST | `src/lib/ir/ast.ts` | tipos `Program/Stmt/Expr` + constructores |
| Parser de expresiones | `src/lib/ir/parse.ts` | texto → `Expr` (recursivo-descendente) |
| Edición | `src/lib/ir/edit.ts` | insertar/borrar/mover sobre el árbol |
| Ejemplos | `src/lib/ir/samples.ts` | algoritmos de arranque |
| Codegen | `src/lib/codegen/index.ts` | AST → pseudo/python/js (un `Dialect` por lenguaje) |
| Intérprete | `src/lib/interp/run.ts` | recorre el AST (generador, paso a paso) |
| Layout DFD | `src/lib/dfd/layout.ts` | AST → nodos/edges de Svelte Flow (ramas y ciclos) |
| Nodos DFD | `src/lib/dfd/nodes/*` | un componente por símbolo |
| UI | `src/lib/components/*`, `src/routes/+page.svelte` | 3 zonas: esquema · diagrama · código+run |

### Sentencias soportadas
`Asignar` (proceso) · `Leer`/`Escribir` (entrada-salida) · `Si/Sino` (decisión) ·
`Mientras` · `Para` · `Repetir…Hasta Que`. Expresiones: aritmética, comparación, lógica
(`y`/`o`/`no`), funciones (`raiz`, `abs`, `piso`, `techo`, `redondear`, `longitud`, `aleatorio`).

## Stack

SvelteKit 2 · Svelte 5 (runes) · TypeScript · Tailwind 4 · **@xyflow/svelte** (Svelte Flow) ·
adapter-static (SPA). pnpm.

> **Nota de tooling:** `@xyflow/svelte` publica `.svelte` con TypeScript. La clave es
> `vitePreprocess({ script: true })` en `svelte.config.js`: transpila el TS (el stripper nativo
> de Svelte 5 deja parámetros opcionales `?` inválidos como JS). Con eso, el prebundle de Vite
> compila la librería bien y NO hace falta tocar `vite.config.ts`. Vite fijado en 7 (Vite 8/
> rolldown aún falla con libs que envían `.svelte`). Si ves errores raros de `@xyflow`, borra
> la caché: `rm -rf node_modules/.vite`.

## Roadmap

- [ ] Insertar nodos directamente en el lienzo (botón "+" sobre los conectores).
- [ ] Codegen para lenguajes tipados (C, C++, Java) con inferencia simple de tipos.
- [ ] Retos/niveles gamificados (enunciado + casos) y juicio real vía Probator/Piston.
- [ ] Código nativo → DFD (parsers) — fuera del MVP.
- [ ] Despliegue (Dokploy) y dominio.
