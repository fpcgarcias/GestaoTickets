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

console.log('[migrate.ts] Verificando DATABASE_URL (este log é após a importação de loadEnv.ts):');
console.log('[migrate.ts] process.env.DATABASE_URL:', process.env.DATABASE_URL ? 'DEFINIDA' : 'NÃO DEFINIDA');
console.log('[migrate.ts] process.cwd():', process.cwd());

import { db } from './db';
import { sql } from 'drizzle-orm';

// Lista de migrações a serem executadas em ordem
const migrations = [
  '20240526-create-departments-table',
  '20240526-add-is-active-to-incident-types',
  '20241225-create-user-notification-settings-table',
];

// Função para verificar se uma migração já foi executada
async function hasMigrationRun(migrationName: string): Promise<boolean> {
  try {
    // Verificar se a tabela de migrações existe
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'migrations'
      );
    `);

    // Se a tabela não existir, criá-la
    if (!tableExists.rows[0]?.exists) {
      await db.execute(sql`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          executed_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      return false;
    }

    // Verificar se a migração já foi executada
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM migrations 
        WHERE name = ${migrationName}
      );
    `);

    return result.rows[0]?.exists === true;
  } catch (error) {
    console.error('Erro ao verificar migração:', error);
    return false;
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
  console.log('Iniciando migrações...');

  for (const migrationName of migrations) {
    try {
      // Verificar se a migração já foi executada
      const alreadyRan = await hasMigrationRun(migrationName);
      if (alreadyRan) {
        console.log(`Migração ${migrationName} já foi executada anteriormente.`);
        continue;
      }

      console.log(`Executando migração: ${migrationName}`);
      
      // Importar e executar a migração
      const migrationPath = `./${path.join('migrations', migrationName)}`;
      const migration = await import(migrationPath);
      
      if (typeof migration.up === 'function') {
        await migration.up();
        // Registrar migração como executada
        await registerMigration(migrationName);
        console.log(`Migração ${migrationName} executada com sucesso.`);
      } else {
        console.error(`Função 'up' não encontrada na migração ${migrationName}.`);
      }
    } catch (error) {
      console.error(`Erro ao executar migração ${migrationName}:`, error);
      // Interromper o processo em caso de erro
      process.exit(1);
    }
  }

  console.log('Migrações concluídas com sucesso!');
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