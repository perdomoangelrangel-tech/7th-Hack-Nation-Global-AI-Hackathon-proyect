#!/usr/bin/env bash
# Setup en una máquina nueva (VS Code). Uso: bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ Node $(node -v) · npm $(npm -v)"
[ -f .env ] || { cp .env.example .env; echo "▶ .env creado desde .env.example — rellena las claves"; }
npm install

if command -v supabase >/dev/null 2>&1; then
  echo "▶ Supabase CLI detectado. Para aplicar migraciones al proyecto remoto:"
  echo "   supabase link --project-ref <ref> && supabase db push"
else
  echo "▶ Supabase CLI no instalado. Alternativa: pega supabase/migrations/*.sql en el SQL Editor del panel, en orden."
fi

echo "▶ Verificando tipos y lint"
npx tsc --noEmit
npm run lint
echo "✔ listo. Siguiente: npm run db:push (o SQL Editor) → npm run ingest → npm run dev"
