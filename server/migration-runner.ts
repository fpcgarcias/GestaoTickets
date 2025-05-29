import { db } from './db';
import { sql } from 'drizzle-orm';

// Importar todas as migrações
import * as migration20241228 from './migrations/20241228-fix-database-structure';
import * as migration20241229 from './migrations/20241229-add-description-to-incident-types';
import * as migration20241229Performance from './migrations/20241229-performance-indexes';

interface Migration {
  id: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Lista de todas as migrações em ordem cronológica
const migrations: Migration[] = [
  {
    id: '20241228-fix-database-structure',
    up: migration20241228.up,
    down: migration20241228.down
  },
  {
    id: '20241229-add-description-to-incident-types',
    up: migration20241229.up,
    down: migration20241229.down
  },
  {
    id: '20241229-performance-indexes',
    up: migration20241229Performance.up,
    down: migration20241229Performance.down
  }
];

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
  
  return result.rows[0]?.count > 0;
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
  console.log('🔄 Verificando migrações pendentes...');
  
  try {
    // Garantir que a tabela de controle existe
    await ensureMigrationsTable();
    
    let migrationsExecuted = 0;
    
    for (const migration of migrations) {
      const isExecuted = await isMigrationExecuted(migration.id);
      
      if (!isExecuted) {
        console.log(`📝 Executando migração: ${migration.id}`);
        
        try {
          await migration.up();
          await markMigrationAsExecuted(migration.id);
          migrationsExecuted++;
          
          console.log(`✅ Migração ${migration.id} executada com sucesso`);
        } catch (error) {
          console.error(`❌ Erro ao executar migração ${migration.id}:`, error);
          throw error;
        }
      } else {
        console.log(`⏭️  Migração ${migration.id} já foi executada`);
      }
    }
    
    if (migrationsExecuted > 0) {
      console.log(`🎉 ${migrationsExecuted} migração(ões) executada(s) com sucesso!`);
    } else {
      console.log('✅ Todas as migrações já estão atualizadas');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a execução das migrações:', error);
    throw error;
  }
}

// Reverter a última migração (para desenvolvimento/debug)
export async function rollbackLastMigration() {
  console.log('🔄 Revertendo última migração...');
  
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
    
    const lastMigrationName = result.rows[0].name;
    const migration = migrations.find(m => m.id === lastMigrationName);
    
    if (!migration) {
      console.error(`❌ Migração ${lastMigrationName} não encontrada no código`);
      return;
    }
    
    console.log(`📝 Revertendo migração: ${lastMigrationName}`);
    
    try {
      await migration.down();
      
      // Remover da tabela de controle
      await db.execute(sql`
        DELETE FROM migrations 
        WHERE name = ${lastMigrationName}
      `);
      
      console.log(`✅ Migração ${lastMigrationName} revertida com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao reverter migração ${lastMigrationName}:`, error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Erro durante a reversão da migração:', error);
    throw error;
  }
}

// Listar status das migrações
export async function listMigrationStatus() {
  console.log('📋 Status das migrações:');
  
  try {
    await ensureMigrationsTable();
    
    for (const migration of migrations) {
      const isExecuted = await isMigrationExecuted(migration.id);
      const status = isExecuted ? '✅ Executada' : '⏳ Pendente';
      console.log(`  ${migration.id}: ${status}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao listar status das migrações:', error);
    throw error;
  }
} 