import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando tabela departments');

  // Primeiro verificar se a tabela já existe para evitar erros
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'departments'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (tableExists) {
    console.log('Tabela departments já existe, pulando criação');
    return;
  }

  // Criar a tabela departments
  await db.execute(sql`
    CREATE TABLE departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      company_id INTEGER REFERENCES companies(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Adicionar comentários para documentação
    COMMENT ON TABLE departments IS 'Armazena os departamentos disponíveis no sistema';
    COMMENT ON COLUMN departments.is_active IS 'Indica se o departamento está ativo ou inativo';

    -- Criar índice para melhorar performance de consultas
    CREATE INDEX idx_departments_company_id ON departments(company_id);
  `);

  // Agora migrar os dados existentes do settings para a nova tabela
  await db.execute(sql`
    -- Popular com departamentos iniciais
    INSERT INTO departments (name, description, is_active)
    SELECT 
      d->>'name' AS name,
      d->>'description' AS description,
      COALESCE((d->>'is_active')::boolean, TRUE) AS is_active
    FROM 
      system_settings, 
      jsonb_array_elements(value::jsonb) AS d
    WHERE 
      key = 'departments'
    ON CONFLICT DO NOTHING;
  `);

  console.log('Migração: Tabela departments criada com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo tabela departments');
  
  // Primeira, verificar se a tabela existe
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'departments'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (!tableExists) {
    console.log('Tabela departments não existe, nada a fazer');
    return;
  }

  // Remover a tabela
  await db.execute(sql`
    DROP TABLE IF EXISTS departments CASCADE;
  `);

  console.log('Reversão: Tabela departments removida com sucesso');
} 