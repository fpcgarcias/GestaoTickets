import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Atualizando enum ai_provider - removendo azure_openai');

  // Primeiro, verificar se existem configurações usando azure_openai
  const azureConfigs = await db.execute(sql`
    SELECT COUNT(*) as count FROM ai_configurations WHERE provider = 'azure_openai';
  `);

  if (azureConfigs.rows[0]?.count > 0) {
    console.log('Atualizando configurações azure_openai para openai...');
    
    // Converter configurações azure_openai para openai
    await db.execute(sql`
      UPDATE ai_configurations 
      SET provider = 'openai' 
      WHERE provider = 'azure_openai';
    `);
  }

  // Atualizar o enum removendo azure_openai
  await db.execute(sql`
    ALTER TYPE ai_provider RENAME TO ai_provider_old;
  `);

  await db.execute(sql`
    CREATE TYPE ai_provider AS ENUM (
      'openai',
      'google',
      'anthropic'
    );
  `);

  await db.execute(sql`
    ALTER TABLE ai_configurations 
    ALTER COLUMN provider TYPE ai_provider 
    USING provider::text::ai_provider;
  `);

  await db.execute(sql`
    ALTER TABLE ai_analysis_history 
    ALTER COLUMN provider TYPE ai_provider 
    USING provider::text::ai_provider;
  `);

  await db.execute(sql`
    DROP TYPE ai_provider_old;
  `);

  console.log('Migration ai_provider enum concluída com sucesso');
}

export async function down() {
  console.log('Revertendo: Restaurando azure_openai no enum ai_provider');
  
  await db.execute(sql`
    ALTER TYPE ai_provider RENAME TO ai_provider_old;
  `);

  await db.execute(sql`
    CREATE TYPE ai_provider AS ENUM (
      'openai',
      'google',
      'anthropic',
      'azure_openai'
    );
  `);

  await db.execute(sql`
    ALTER TABLE ai_configurations 
    ALTER COLUMN provider TYPE ai_provider 
    USING provider::text::ai_provider;
  `);

  await db.execute(sql`
    ALTER TABLE ai_analysis_history 
    ALTER COLUMN provider TYPE ai_provider 
    USING provider::text::ai_provider;
  `);

  await db.execute(sql`
    DROP TYPE ai_provider_old;
  `);
  
  console.log('Rollback ai_provider enum concluído');
} 