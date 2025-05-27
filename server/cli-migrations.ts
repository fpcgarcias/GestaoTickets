#!/usr/bin/env node

import "./loadEnv"; // Carregar variáveis de ambiente
import { runMigrations, rollbackLastMigration, listMigrationStatus } from './migration-runner';

const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'up':
      case 'migrate':
        console.log('🚀 Executando migrações...');
        await runMigrations();
        break;
        
      case 'down':
      case 'rollback':
        console.log('🔄 Revertendo última migração...');
        await rollbackLastMigration();
        break;
        
      case 'status':
      case 'list':
        console.log('📋 Listando status das migrações...');
        await listMigrationStatus();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        console.log(`
📋 Comandos disponíveis para migrações:

  npm run migrate:up      - Executar todas as migrações pendentes
  npm run migrate:down    - Reverter a última migração
  npm run migrate:status  - Listar status das migrações
  npm run migrate:help    - Mostrar esta ajuda

Exemplos:
  npm run migrate:up      # Executar migrações
  npm run migrate:status  # Ver quais migrações foram executadas
  npm run migrate:down    # Reverter última migração (cuidado!)
        `);
        break;
        
      default:
        console.error(`❌ Comando desconhecido: ${command}`);
        console.log('Use "npm run migrate:help" para ver os comandos disponíveis.');
        process.exit(1);
    }
    
    console.log('✅ Operação concluída com sucesso!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro durante a operação:', error);
    process.exit(1);
  }
}

main(); 