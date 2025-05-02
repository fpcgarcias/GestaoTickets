import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Script para adicionar o campo active à tabela de usuários
 */
export async function migrateActiveField() {
  console.log('Iniciando migração do campo active...');
  
  try {
    // Verificar se a coluna já existe
    const result = await db.execute(
      sql`SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'active'`
    );
    
    if (result.rows.length === 0) {
      // A coluna não existe, vamos adicioná-la
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE`
      );
      console.log('Coluna active adicionada à tabela users');
    } else {
      console.log('Coluna active já existe na tabela users, pulando criação');
    }
    
    console.log('Migração do campo active concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao migrar campo active:', error);
  }
}
