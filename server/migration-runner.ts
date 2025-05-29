import { db } from './db';
import { sql } from 'drizzle-orm';

interface Migration {
  id: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Lista vazia de migrações - todas foram removidas
const migrations: Migration[] = [];

// Criar tabela de controle de migrações se não existir
async function ensureMigrationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
    )
  `);
}

// Verificar se uma migração já foi executada
async function isMigrationExecuted(migrationName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM migrations 
    WHERE name = ${migrationName}
  `);
  
  return (result.rows[0] as any)?.count > 0;
}

// Marcar migração como executada
async function markMigrationAsExecuted(migrationName: string) {
  await db.execute(sql`
    INSERT INTO migrations (name, executed_at) 
    VALUES (${migrationName}, now())
  `);
}

// Executar todas as migrações pendentes
export async function runMigrations() {
  console.log('🔄 Verificando sistema de migrações...');
  
  try {
    // Garantir que a tabela de controle existe
    await ensureMigrationsTable();
    
    // Como não há migrações na lista, apenas confirmar que o sistema está pronto
    console.log('✅ Sistema de migrações inicializado (nenhuma migração pendente)');
    
  } catch (error) {
    console.error('❌ Erro durante a inicialização do sistema de migrações:', error);
    // Não lançar erro para não quebrar o startup
  }
}

// Reverter a última migração (para desenvolvimento/debug)
export async function rollbackLastMigration() {
  console.log('🔄 Função de rollback disponível (nenhuma migração ativa)');
  
  try {
    await ensureMigrationsTable();
    
    // Buscar a última migração executada
    const result = await db.execute(sql`
      SELECT name 
      FROM migrations 
      ORDER BY executed_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('ℹ️  Nenhuma migração para reverter');
      return;
    }
    
    const lastMigrationName = (result.rows[0] as any).name;
    console.log(`ℹ️  Última migração registrada: ${lastMigrationName} (sem código de rollback disponível)`);
    
  } catch (error) {
    console.error('❌ Erro durante a verificação de rollback:', error);
  }
}

// Listar status das migrações
export async function listMigrationStatus() {
  console.log('📋 Sistema de migrações limpo - nenhuma migração ativa');
  
  try {
    await ensureMigrationsTable();
    
    // Verificar se há migrações antigas registradas
    const result = await db.execute(sql`
      SELECT name, executed_at 
      FROM migrations 
      ORDER BY executed_at DESC
    `);
    
    if (result.rows.length > 0) {
      console.log('📜 Migrações históricas encontradas:');
      for (const row of result.rows) {
        const migrationRow = row as any;
        console.log(`  ${migrationRow.name}: executada em ${migrationRow.executed_at}`);
      }
    } else {
      console.log('📋 Nenhuma migração registrada no histórico');
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar status das migrações:', error);
  }
} 