import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('🔄 Iniciando migration: Adicionar coluna description à tabela incident_types');

  try {
    // Verificar se a coluna description já existe
    const descriptionExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incident_types' 
      AND column_name = 'description'
      AND table_schema = 'public'
    `);

    if (descriptionExists.rows.length === 0) {
      console.log('📝 Adicionando coluna description à tabela incident_types');
      
      // Adicionar a coluna description
      await db.execute(sql`
        ALTER TABLE incident_types 
        ADD COLUMN description text
      `);
      
      console.log('✅ Coluna description adicionada com sucesso');
    } else {
      console.log('✅ Coluna description já existe na tabela incident_types');
    }

    console.log('✅ Migration concluída: Coluna description adicionada à tabela incident_types');

  } catch (error) {
    console.error('❌ Erro durante a migration:', error);
    throw error;
  }
}

export async function down() {
  console.log('🔄 Revertendo migration: Remover coluna description da tabela incident_types');
  
  try {
    // Verificar se a coluna description existe antes de tentar removê-la
    const descriptionExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incident_types' 
      AND column_name = 'description'
      AND table_schema = 'public'
    `);

    if (descriptionExists.rows.length > 0) {
      console.log('🗑️ Removendo coluna description da tabela incident_types');
      
      // Remover a coluna description
      await db.execute(sql`
        ALTER TABLE incident_types 
        DROP COLUMN description
      `);
      
      console.log('✅ Coluna description removida com sucesso');
    } else {
      console.log('✅ Coluna description já foi removida da tabela incident_types');
    }

    console.log('✅ Rollback concluído: Coluna description removida da tabela incident_types');

  } catch (error) {
    console.error('❌ Erro durante o rollback:', error);
    throw error;
  }
} 