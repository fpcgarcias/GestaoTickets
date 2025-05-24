import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('🔄 Iniciando migration: Alterar campo department para department_id na tabela officials');

  try {
    // 1. Verificar se a coluna department_id já existe
    const departmentIdExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'officials' 
      AND column_name = 'department_id'
    `);

    if (departmentIdExists.rows.length === 0) {
      console.log('📝 Adicionando coluna department_id à tabela officials');
      
      // 2. Adicionar a nova coluna department_id
      await db.execute(sql`
        ALTER TABLE officials 
        ADD COLUMN department_id INTEGER REFERENCES departments(id)
      `);
    } else {
      console.log('✅ Coluna department_id já existe');
    }

    // 3. Mapear valores do enum department para IDs da tabela departments
    console.log('🔄 Mapeando valores do enum para IDs de departamentos');
    
    // Criar departamentos padrão se não existirem
    await db.execute(sql`
      INSERT INTO departments (name, description, is_active, created_at, updated_at)
      SELECT 'Suporte Técnico', 'Departamento de suporte técnico', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Suporte Técnico')
    `);
    
    await db.execute(sql`
      INSERT INTO departments (name, description, is_active, created_at, updated_at)
      SELECT 'Financeiro', 'Departamento financeiro e cobrança', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Financeiro')
    `);
    
    await db.execute(sql`
      INSERT INTO departments (name, description, is_active, created_at, updated_at)
      SELECT 'Geral', 'Departamento geral', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Geral')
    `);
    
    await db.execute(sql`
      INSERT INTO departments (name, description, is_active, created_at, updated_at)
      SELECT 'Vendas', 'Departamento de vendas', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Vendas')
    `);
    
    await db.execute(sql`
      INSERT INTO departments (name, description, is_active, created_at, updated_at)
      SELECT 'Outros', 'Outros departamentos', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Outros')
    `);

    // 4. Atualizar department_id baseado no valor atual de department
    console.log('🔄 Atualizando department_id baseado nos valores atuais de department');
    
    await db.execute(sql`
      UPDATE officials 
      SET department_id = (
        SELECT d.id FROM departments d 
        WHERE d.name = CASE officials.department
          WHEN 'technical' THEN 'Suporte Técnico'
          WHEN 'billing' THEN 'Financeiro' 
          WHEN 'general' THEN 'Geral'
          WHEN 'sales' THEN 'Vendas'
          WHEN 'other' THEN 'Outros'
          ELSE 'Geral'
        END
        LIMIT 1
      )
      WHERE department_id IS NULL
    `);

    // 5. Verificar se a coluna department ainda existe antes de tentar removê-la
    const departmentExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'officials' 
      AND column_name = 'department'
    `);

    if (departmentExists.rows.length > 0) {
      console.log('🗑️ Removendo coluna department antiga');
      
      // 6. Remover a coluna department antiga
      await db.execute(sql`
        ALTER TABLE officials 
        DROP COLUMN IF EXISTS department
      `);
    } else {
      console.log('✅ Coluna department já foi removida');
    }

    console.log('✅ Migration concluída: Campo department convertido para department_id');

  } catch (error) {
    console.error('❌ Erro na migration:', error);
    throw error;
  }
}

export async function down() {
  console.log('🔄 Revertendo migration: Voltando department_id para department');

  try {
    // 1. Verificar se a coluna department existe
    const departmentExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'officials' 
      AND column_name = 'department'
    `);

    if (departmentExists.rows.length === 0) {
      // 2. Recriar a coluna department como enum
      await db.execute(sql`
        ALTER TABLE officials 
        ADD COLUMN department department
      `);

      // 3. Restaurar valores baseados em department_id
      await db.execute(sql`
        UPDATE officials 
        SET department = (
          CASE 
            WHEN d.name = 'Suporte Técnico' THEN 'technical'::department
            WHEN d.name = 'Financeiro' THEN 'billing'::department
            WHEN d.name = 'Geral' THEN 'general'::department
            WHEN d.name = 'Vendas' THEN 'sales'::department
            WHEN d.name = 'Outros' THEN 'other'::department
            ELSE 'general'::department
          END
        )
        FROM departments d 
        WHERE officials.department_id = d.id
      `);
    }

    // 4. Remover coluna department_id
    await db.execute(sql`
      ALTER TABLE officials 
      DROP COLUMN IF EXISTS department_id
    `);

    console.log('✅ Rollback concluído');

  } catch (error) {
    console.error('❌ Erro no rollback:', error);
    throw error;
  }
} 