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

- **Diagrama de flujo estilo PSeInt** (SVG, drag-and-drop): paleta de bloques DFD a la
  izquierda; los arrastras al lienzo central y se insertan en el flujo, dibujado con **figuras
  reales** (óvalo, rectángulo, paralelogramo, rombo) y **líneas con flechas**. Las decisiones
  **se bifurcan en dos caminos Sí/No** y se reúnen; los ciclos dibujan su back-edge. El diagrama
  se **deriva** del AST (estructurado por construcción → siempre genera código válido). Clic en
  una figura para editarla en el panel flotante; arrastra una figura para moverla; suelta sobre
  las líneas para insertar.
- **Código en vivo** (panel derecho): el mismo algoritmo en Pseudocódigo / Python / JavaScript,
  actualizándose con cada cambio.
- **Ejecución en el navegador**: intérprete del AST con Correr / Paso / Pausa / Reiniciar,
  resaltado del bloque activo, consola de salida y tabla de variables. Sin servidor.

## Arquitectura

El **AST estructurado** (`src/lib/ir/ast.ts`) es el hub: todo deriva de él.

| Pieza | Ruta | Qué hace |
|------|------|----------|
| IR / AST | `src/lib/ir/ast.ts` | tipos `Program/Stmt/Expr` + constructores |
| Parser de expresiones | `src/lib/ir/parse.ts` | texto → `Expr` (recursivo-descendente) |
| Edición | `src/lib/ir/edit.ts` | insertar/borrar/mover/reubicar sobre el árbol (con guardas) |
| Drag-and-drop | `src/lib/dnd.ts` | store del bloque que se arrastra (nuevo de paleta / mover) |
| Ejemplos | `src/lib/ir/samples.ts` | algoritmos de arranque |
| Codegen | `src/lib/codegen/index.ts` | AST → pseudo/python/js (un `Dialect` por lenguaje) |
| Intérprete | `src/lib/interp/run.ts` | recorre el AST (generador, paso a paso) |
| Layout flujo | `src/lib/dfd/flowlayout.ts` | AST → geometría (figuras, líneas ortogonales, ramas, drops) |
| Bloques | `src/lib/dfd/blockmeta.ts`, `labels.ts`, `active.ts` | metadatos/etiquetas/estado |
| UI | `BlockPalette`, `FlowCanvas` (+`NodeEditor`), `CodePanel`, `RunPanel`, `+page.svelte` | 3 zonas: paleta · diagrama de flujo · código+run |

### Sentencias soportadas
`Asignar` (proceso) · `Leer`/`Escribir` (entrada-salida) · `Si/Sino` (decisión) ·
`Mientras` · `Para` · `Repetir…Hasta Que`. Expresiones: aritmética, comparación, lógica
(`y`/`o`/`no`), funciones (`raiz`, `abs`, `piso`, `techo`, `redondear`, `longitud`, `aleatorio`).

## Stack

SvelteKit 2 · Svelte 5 (runes) · TypeScript · Tailwind 4 · drag-and-drop nativo del navegador ·
adapter-static (SPA). pnpm. (Sin dependencias de runtime: el lienzo es DOM propio.)

> **Nota:** Vite fijado en 7 (Vite 8/rolldown daba problemas). El editor de bloques es DOM
> propio con drag-and-drop nativo, sin librerías de canvas. (Antes se usó Svelte Flow; se
> retiró al pasar al modelo de bloques que encajan.)

## Roadmap

- [ ] Afinar el ruteo de líneas (salida de ciclos por el margen, evitar cruces).
- [ ] Codegen para lenguajes tipados (C, C++, Java) con inferencia simple de tipos.
- [ ] Retos/niveles gamificados (enunciado + casos) y juicio real vía Probator/Piston.
- [ ] Código nativo → DFD (parsers) — fuera del MVP.
- [ ] Despliegue (Dokploy) y dominio.
