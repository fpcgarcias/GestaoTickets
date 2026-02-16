import { db } from './db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Migration {
  id: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Função para carregar migrações dos arquivos SQL
function loadMigrationsFromFiles(): Migration[] {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('📁 Diretório de migrações não encontrado:', migrationsDir);
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Garante ordem alfabética/numérica

  return files.map(file => {
    const migrationId = path.basename(file, '.sql');
    const filePath = path.join(migrationsDir, file);
    
    return {
      id: migrationId,
      up: async () => {
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        console.log(`🔄 Executando migração: ${migrationId}`);
        
        // Dividir comandos SQL corretamente (remover comentários primeiro)
        const cleanContent = sqlContent
          .replace(/--.*$/gm, '') // Remove comentários de linha
          .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comentários de bloco
          .trim();
        
        const commands = cleanContent
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0);

        console.log(`📋 Executando ${commands.length} comando(s) SQL...`);

        // Executar em transação única
        await db.transaction(async (tx) => {
          for (let i = 0; i < commands.length; i++) {
            const command = commands[i];
            try {
              console.log(`🔧 Comando ${i + 1}/${commands.length}`);
              await tx.execute(sql.raw(command));
              console.log(`✅ Comando ${i + 1} concluído`);
            } catch (error) {
              console.error(`❌ Erro no comando ${i + 1}:`, error);
              console.error(`❌ SQL:`, command);
              throw error; // Isso fará rollback da transação
            }
          }
        });
        
        console.log(`✅ Migração ${migrationId} executada com sucesso`);
      },
      down: async () => {
        console.log(`⚠️  Rollback não implementado para ${migrationId}`);
      }
    };
  });
}

// Carregar migrações dos arquivos
const migrations: Migration[] = loadMigrationsFromFiles();

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

// Remover migração do registro (para reexecutar)
async function _removeMigrationRecord(migrationName: string) {
  await db.execute(sql`
    DELETE FROM migrations 
    WHERE name = ${migrationName}
  `);
}

// Executar todas as migrações pendentes
export async function runMigrations() {
  try {
    // Garantir que a tabela de controle existe
    await ensureMigrationsTable();
    
    // Executar migrações pendentes
    let executedCount = 0;
    
    for (const migration of migrations) {
      const alreadyExecuted = await isMigrationExecuted(migration.id);
      
      if (!alreadyExecuted) {
        console.log(`🚀 Executando migração pendente: ${migration.id}`);
        await migration.up();
        await markMigrationAsExecuted(migration.id);
        executedCount++;
      }
    }
    
    if (executedCount > 0) {
      console.log(`✅ ${executedCount} migração(ões) executada(s) com sucesso`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a execução das migrações:', error);
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