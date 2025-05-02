import { db } from './db';
import { officials, officialDepartments } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function migrateDepartmentsToJunctionTable() {
  try {
    console.log('Iniciando migração de departamentos...');
    
    // Verificar se a tabela official_departments já existe
    try {
      await db.execute(sql`SELECT 1 FROM official_departments LIMIT 1`);
      console.log('Tabela official_departments já existe, pulando criação');
    } catch (error) {
      // Tabela não existe, vamos criá-la
      console.log('Criando tabela official_departments...');
      await db.execute(sql`
        CREATE TABLE official_departments (
          id SERIAL PRIMARY KEY,
          official_id INTEGER NOT NULL REFERENCES officials(id),
          department TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        )
      `);
    }
    
    // Verificar se a coluna department ainda existe na tabela officials
    try {
      const result = await db.execute(sql`
        SELECT id, department FROM officials WHERE department IS NOT NULL
      `);
      
      const officials = result.rows || [];
      console.log(`Encontrados ${officials.length} atendentes com departamentos para migrar`);
      
      // Migrar dados
      for (const official of officials) {
        if (official.department) {
          // Inserir na nova tabela de junção
          await db.execute(sql`
            INSERT INTO official_departments (official_id, department)
            VALUES (${official.id}, ${official.department})
          `);
          console.log(`Migrado departamento ${official.department} para atendente ${official.id}`);
        }
      }
      
      console.log('Migração de departamentos concluída com sucesso!');
    } catch (error) {
      // A coluna department provavelmente não existe mais
      console.log('Coluna department não encontrada, migração não é necessária');
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao migrar departamentos:', error);
    return false;
  }
}
