import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Adicionando coluna is_active à tabela incident_types');

  // Primeiro verificar se a coluna já existe para evitar erros
  const columnResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'incident_types' 
      AND column_name = 'is_active'
    );
  `);
  
  const columnExists = columnResult.rows[0]?.exists === true;
  
  if (columnExists) {
    console.log('Coluna is_active já existe na tabela incident_types, pulando criação');
    return;
  }

  // Adicionar a coluna is_active
  await db.execute(sql`
    ALTER TABLE incident_types ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    
    -- Adicionar comentário para documentação
    COMMENT ON COLUMN incident_types.is_active IS 'Indica se o tipo de chamado está ativo ou inativo';
  `);

  console.log('Migração: Coluna is_active adicionada com sucesso à tabela incident_types');
}

export async function down() {
  console.log('Revertendo: Removendo coluna is_active da tabela incident_types');
  
  // Primeiro verificar se a coluna existe
  const columnResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'incident_types' 
      AND column_name = 'is_active'
    );
  `);
  
  const columnExists = columnResult.rows[0]?.exists === true;
  
  if (!columnExists) {
    console.log('Coluna is_active não existe na tabela incident_types, nada a fazer');
    return;
  }

  // Remover a coluna
  await db.execute(sql`
    ALTER TABLE incident_types DROP COLUMN IF EXISTS is_active;
  `);

  console.log('Reversão: Coluna is_active removida com sucesso da tabela incident_types');
} 