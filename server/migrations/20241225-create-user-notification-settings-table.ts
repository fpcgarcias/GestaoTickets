import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando tabela user_notification_settings');

  // Primeiro verificar se a tabela já existe para evitar erros
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_notification_settings'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (tableExists) {
    console.log('Tabela user_notification_settings já existe, pulando criação');
    return;
  }

  // Criar a tabela user_notification_settings
  await db.execute(sql`
    CREATE TABLE user_notification_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      -- Notificações de tickets
      new_ticket_assigned BOOLEAN DEFAULT TRUE,
      ticket_status_changed BOOLEAN DEFAULT TRUE,
      new_reply_received BOOLEAN DEFAULT TRUE,
      ticket_escalated BOOLEAN DEFAULT TRUE,
      ticket_due_soon BOOLEAN DEFAULT TRUE,
      
      -- Notificações administrativas
      new_customer_registered BOOLEAN DEFAULT TRUE,
      new_user_created BOOLEAN DEFAULT TRUE,
      system_maintenance BOOLEAN DEFAULT TRUE,
      
      -- Preferências de entrega
      email_notifications BOOLEAN DEFAULT TRUE,
      
      -- Configurações de horário
      notification_hours_start INTEGER DEFAULT 9,
      notification_hours_end INTEGER DEFAULT 18,
      weekend_notifications BOOLEAN DEFAULT FALSE,
      
      -- Configurações de frequência
      digest_frequency TEXT DEFAULT 'never' CHECK (digest_frequency IN ('never', 'daily', 'weekly')),
      
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Adicionar comentários para documentação
    COMMENT ON TABLE user_notification_settings IS 'Armazena as configurações individuais de notificação de cada usuário';
    COMMENT ON COLUMN user_notification_settings.user_id IS 'Referência ao usuário proprietário das configurações';
    COMMENT ON COLUMN user_notification_settings.digest_frequency IS 'Frequência do resumo por email: never, daily, weekly';

    -- Criar índice para melhorar performance de consultas
    CREATE INDEX idx_user_notification_settings_user_id ON user_notification_settings(user_id);
    CREATE UNIQUE INDEX idx_user_notification_settings_user_unique ON user_notification_settings(user_id);
  `);

  console.log('Migração: Tabela user_notification_settings criada com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo tabela user_notification_settings');
  
  // Primeira, verificar se a tabela existe
  const tablesResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_notification_settings'
    );
  `);
  
  const tableExists = tablesResult.rows[0]?.exists === true;
  
  if (!tableExists) {
    console.log('Tabela user_notification_settings não existe, nada a fazer');
    return;
  }

  // Remover a tabela
  await db.execute(sql`
    DROP TABLE IF EXISTS user_notification_settings CASCADE;
  `);

  console.log('Reversão: Tabela user_notification_settings removida com sucesso');
} 