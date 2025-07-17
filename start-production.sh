#!/bin/bash
# Script para iniciar servidor em produção

echo "🚀 Iniciando servidor em PRODUÇÃO..."

# Definir variáveis de ambiente
export NODE_ENV=production
export PORT=5173

# Verificar se existe build
if [ ! -d "dist/public" ]; then
    echo "⚠️  Build não encontrado. Executando build..."
    npm run build
fi

# Iniciar servidor em produção
echo "✅ Iniciando servidor com NODE_ENV=production"
npm run start:prod 