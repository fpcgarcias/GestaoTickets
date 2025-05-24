import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Adicionando colunas de hierarquia à tabela officials');

  // Verificar se as colunas já existem para evitar erros
  const supervisorColumnResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'officials' 
      AND column_name = 'supervisor_id'
    );
  `);
  
  const managerColumnResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'officials' 
      AND column_name = 'manager_id'
    );
  `);
  
  const supervisorExists = supervisorColumnResult.rows[0]?.exists;
  const managerExists = managerColumnResult.rows[0]?.exists;
  
  if (!supervisorExists) {
    console.log('Adicionando coluna supervisor_id...');
    await db.execute(sql`
      ALTER TABLE "officials" ADD COLUMN "supervisor_id" integer;
    `);
    
    await db.execute(sql`
      ALTER TABLE "officials" ADD CONSTRAINT "officials_supervisor_id_officials_id_fk" 
      FOREIGN KEY ("supervisor_id") REFERENCES "officials"("id") ON DELETE set null ON UPDATE no action;
    `);
    
    await db.execute(sql`
      COMMENT ON COLUMN "officials"."supervisor_id" IS 'ID do supervisor direto do atendente';
    `);
  } else {
    console.log('Coluna supervisor_id já existe, pulando...');
  }
  
  if (!managerExists) {
    console.log('Adicionando coluna manager_id...');
    await db.execute(sql`
      ALTER TABLE "officials" ADD COLUMN "manager_id" integer;
    `);
    
    await db.execute(sql`
      ALTER TABLE "officials" ADD CONSTRAINT "officials_manager_id_officials_id_fk" 
      FOREIGN KEY ("manager_id") REFERENCES "officials"("id") ON DELETE set null ON UPDATE no action;
    `);
    
    await db.execute(sql`
      COMMENT ON COLUMN "officials"."manager_id" IS 'ID do manager/gestor do atendente';
    `);
  } else {
    console.log('Coluna manager_id já existe, pulando...');
  }

  console.log('Migração de hierarquia concluída com sucesso!');
} 