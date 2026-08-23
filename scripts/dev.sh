#!/bin/bash
# Script de démarrage dev — Mouvement Christ Libère
# Charge les variables .env.local avant de lancer Next.js

set -e

cd "$(dirname "$0")/.."

# Charger .env.local (prioritaire sur .env système)
if [ -f ".env.local" ]; then
  export $(grep -v '^#' .env.local | grep -v '^\s*$' | xargs)
elif [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)
fi

echo "[dev] DATABASE_URL length: ${#DATABASE_URL}"
echo "[dev] Starting Next.js..."
exec bun run dev
