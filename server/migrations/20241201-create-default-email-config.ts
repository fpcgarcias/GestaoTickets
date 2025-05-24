import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando configurações padrão de e-mail');

  // Inserir configurações básicas de e-mail para permitir funcionamento
  // Nota: Estas são configurações de exemplo - o admin deve configurar com dados reais
  await db.execute(sql`
    INSERT INTO system_settings (key, value, created_at, updated_at) 
    VALUES 
      ('email_provider', 'smtp', NOW(), NOW()),
      ('email_enabled', 'false', NOW(), NOW()),
      ('smtp_host', 'smtp.gmail.com', NOW(), NOW()),
      ('smtp_port', '587', NOW(), NOW()),
      ('smtp_secure', 'true', NOW(), NOW()),
      ('smtp_user', '', NOW(), NOW()),
      ('smtp_password', '', NOW(), NOW()),
      ('from_email', 'noreply@ticketflow.com.br', NOW(), NOW()),
      ('from_name', 'Sistema de Tickets', NOW(), NOW())
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log('Configurações padrão de e-mail criadas com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo configurações padrão de e-mail');

  await db.execute(sql`
    DELETE FROM system_settings 
    WHERE key IN (
      'email_provider', 'email_enabled', 'smtp_host', 'smtp_port', 
      'smtp_secure', 'smtp_user', 'smtp_password', 'from_email', 'from_name'
    );
  `);
} 