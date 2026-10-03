#!/usr/bin/env bash
# Setup en una máquina nueva. Uso: bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Node $(node -v) · npm $(npm -v)"
[ -f .env.local ] || { cp .env.example .env.local; echo "▶ .env.local creado desde .env.example — pega tu OPENAI_API_KEY (opcional)"; }
npm install

echo "▶ Verificando tipos, lint y tests"
npm run typecheck
npm run lint
npm test
echo "✔ listo. El grafo ya viene en data/atlas.json → npm run dev → http://localhost:3000/atlas"
echo "  Para reconstruirlo desde las fuentes: npm run data:refresh (y npm run extract si tienes OPENAI_API_KEY)"
