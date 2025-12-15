#!/usr/bin/env node

/**
 * Script para diagnosticar problemas de senha
 * Execute: node scripts/diagnose-passwords.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  try {
    console.log('🔍 Iniciando diagnóstico de senhas...\n');
    
    // Importar função de diagnóstico
    const { diagnosePaswordIssues } = await import('../server/utils/password-migration.js');
    
    await diagnosePaswordIssues();
    
    console.log('\n✅ Diagnóstico concluído!');
    console.log('\n💡 Dicas para resolver problemas:');
    console.log('   - Senhas devem ter pelo menos 8 caracteres');
    console.log('   - Devem conter: maiúscula, minúscula, número e caractere especial (@$!%*?&)');
    console.log('   - Não podem conter sequências comuns (123456, qwerty, password, etc.)');
    console.log('\n🔧 Para corrigir, você pode:');
    console.log('   1. Atualizar as senhas problemáticas diretamente no banco');
    console.log('   2. Ou usar o sistema de reset de senha para os usuários afetados');
    
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    process.exit(1);
  }
}

main();