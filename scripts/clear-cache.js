#!/usr/bin/env node

/**
 * Script para limpar completamente o cache do projeto
 * Resolve problemas de cache que causam loops infinitos
 */

import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';
import path from 'path';

const projectRoot = process.cwd();

console.log('🧹 Iniciando limpeza completa do cache...\n');

// Diretórios e arquivos de cache para remover
const cacheTargets = [
  'node_modules/.vite',
  'node_modules/.cache',
  'client/node_modules/.vite',
  'client/node_modules/.cache',
  'dist',
  '.vite',
  'client/.vite',
  'client/dist',
  'vite.config.ts.timestamp-*'
];

// Função para remover diretório/arquivo se existir
function removeIfExists(target) {
  const fullPath = path.join(projectRoot, target);
  if (existsSync(fullPath)) {
    try {
      rmSync(fullPath, { recursive: true, force: true });
      console.log(`✅ Removido: ${target}`);
    } catch (error) {
      console.log(`⚠️  Erro ao remover ${target}:`, error.message);
    }
  } else {
    console.log(`ℹ️  Não encontrado: ${target}`);
  }
}

// Remover caches do sistema de arquivos
console.log('📁 Removendo caches do sistema de arquivos...');
cacheTargets.forEach(removeIfExists);

// Limpar cache do npm/yarn
console.log('\n📦 Limpando cache do gerenciador de pacotes...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
  console.log('✅ Cache do npm limpo');
} catch (error) {
  console.log('⚠️  Erro ao limpar cache do npm:', error.message);
}

// Limpar cache do npm (sem reinstalar dependências)
console.log('\n📦 Limpando apenas cache do npm...');
try {
  execSync('npm cache clean --force', { stdio: 'inherit' });
  console.log('✅ Cache do npm limpo (dependências mantidas)');
} catch (error) {
  console.log('⚠️  Erro ao limpar cache do npm:', error.message);
}

console.log('\n🎉 Limpeza de cache finalizada!');
console.log('💡 Dependências mantidas intactas');
console.log('💡 Agora execute: npm run dev');