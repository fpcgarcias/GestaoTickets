import "./loadEnv"; // Importar PRIMEIRO para carregar variáveis de ambiente

// Carregar variáveis de ambiente PRIMEIRO!
// import dotenv from "dotenv"; // Movido para loadEnv.ts
// import path from 'path'; // Movido para loadEnv.ts
// import fs from 'fs'; // fs ainda é usado abaixo, mas o carregamento do .env foi movido
import fs from 'fs'; // Manter esta importação, pois path.join é usado abaixo
import path from 'path'; // Manter esta importação

// Determinar o caminho para o arquivo .env na raiz do projeto
// const envPath = path.resolve(process.cwd(), '.env'); // Movido para loadEnv.ts
// console.log(`[migrate.ts] Tentando carregar .env de: ${envPath}`); // Movido para loadEnv.ts
// const dotenvResult = dotenv.config({ path: envPath }); // Movido para loadEnv.ts

// if (dotenvResult.error) {
//   console.error('[migrate.ts] Erro ao carregar .env:', dotenvResult.error); // Movido para loadEnv.ts
// } else {
//   console.log('[migrate.ts] .env carregado com sucesso.'); // Movido para loadEnv.ts
//   if (dotenvResult.parsed) {
//     console.log('[migrate.ts] Variáveis carregadas do .env:', Object.keys(dotenvResult.parsed)); // Movido para loadEnv.ts
//   }
// }

import { db } from './db';
import { sql } from 'drizzle-orm';

// Lista de migrações a serem executadas em ordem
const migrations = [
  '20240526-create-departments-table',
  '20240526-add-is-active-to-incident-types',
  '20241201-create-ai-configuration-tables',
  '20241201-create-default-email-config',
  '20241201-update-default-ai-prompts',
  '20241225-create-user-notification-settings-table',
  '20241226-add-hierarchy-to-officials',
  '20241226-fix-officials-department-field',
  '20241227-create-ticket-attachments-table',
  '20241227-create-email-templates-table',
];

// Função para verificar quais migrações ainda não foram executadas
async function getPendingMigrations(): Promise<string[]> {
  try {
    // Verificar se a tabela de migrações existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);

    // Se a tabela não existir, criá-la e todas as migrações são pendentes
    if (!tableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          executed_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      return migrations;
    }

    // Buscar todas as migrações já executadas
    const executedMigrations = await db.execute(sql`
      SELECT name FROM migrations
    `);

    const executedNames = executedMigrations.rows.map(row => row.name as string);
    
    // Retornar apenas as migrações que ainda não foram executadas
    return migrations.filter(migration => !executedNames.includes(migration));
  } catch (error) {
    console.error('Erro ao verificar migrações pendentes:', error);
    return [];
  }
}

// Função para registrar uma migração executada
async function registerMigration(migrationName: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO migrations (name) 
    VALUES (${migrationName});
  `);
}

// Função principal para executar as migrações
async function migrate() {
  // Verificar quais migrações são necessárias
  const pendingMigrations = await getPendingMigrations();
  
  if (pendingMigrations.length === 0) {
    // Não mostrar nada se não há migrações pendentes - sistema já está atualizado
    return;
  }

  console.log(`Iniciando ${pendingMigrations.length} migração(ões) pendente(s)...`);

  for (const migrationName of pendingMigrations) {
    try {
      console.log(`Executando migração: ${migrationName}`);
      
      // Importar e executar a migração
      const migrationPath = `./${path.join('migrations', migrationName)}`;
      const migration = await import(migrationPath);
      
      if (typeof migration.up === 'function') {
        await migration.up();
        // Registrar migração como executada
        await registerMigration(migrationName);
        console.log(`✅ Migração ${migrationName} executada com sucesso.`);
      } else {
        console.error(`❌ Função 'up' não encontrada na migração ${migrationName}.`);
      }
    } catch (error) {
      console.error(`❌ Erro ao executar migração ${migrationName}:`, error);
      // Interromper o processo em caso de erro
      process.exit(1);
    }
  }

  console.log('✅ Migrações concluídas com sucesso!');
}

// Exportar como módulo para ser usado pelo servidor
export { migrate };

// Auto-executar se este arquivo for o ponto de entrada
// Determinar se o script está sendo executado diretamente
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  console.log('[migrate.ts] Executando migrações diretamente (script é o ponto de entrada).');
  migrate()
    .then(() => {
      console.log('[migrate.ts] Migrações diretas concluídas, saindo com código 0.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[migrate.ts] Erro ao executar migrações diretas:', error);
      process.exit(1);
    });
} 