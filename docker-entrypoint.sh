#!/usr/bin/env bash
# Aplica el schema antes de arrancar el servidor.
set -e

echo "[dedalo] aplicando schema (drizzle-kit push)..."
pnpm drizzle-kit push --force || pnpm drizzle-kit push

echo "[dedalo] iniciando servidor en :${PORT:-3000}"
exec node build
