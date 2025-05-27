import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function up() {
  console.log('🔧 Iniciando migração para corrigir estrutura do banco de dados...');

  try {
    // 1. Corrigir nomes das colunas da tabela companies (camelCase -> snake_case)
    console.log('📝 Corrigindo nomes das colunas da tabela companies...');
    
    // Verificar se as colunas camelCase existem antes de renomear
    const companiesColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND table_schema = 'public'
    `);
    
    const columnNames = companiesColumns.rows.map((row: any) => row.column_name);
    
    if (columnNames.includes('createdAt')) {
      await db.execute(sql`ALTER TABLE companies RENAME COLUMN "createdAt" TO created_at`);
      console.log('✅ Renomeado createdAt -> created_at');
    }
    
    if (columnNames.includes('updatedAt')) {
      await db.execute(sql`ALTER TABLE companies RENAME COLUMN "updatedAt" TO updated_at`);
      console.log('✅ Renomeado updatedAt -> updated_at');
    }

    // 2. Criar tabela departments se não existir
    console.log('📝 Criando tabela departments...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        company_id INTEGER REFERENCES companies(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ Tabela departments criada');

    // 3. Adicionar colunas faltantes na tabela officials
    console.log('📝 Atualizando tabela officials...');
    
    // Verificar colunas existentes
    const officialsColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'officials' AND table_schema = 'public'
    `);
    
    const officialsColumnNames = officialsColumns.rows.map((row: any) => row.column_name);
    
    if (!officialsColumnNames.includes('company_id')) {
      await db.execute(sql`ALTER TABLE officials ADD COLUMN company_id INTEGER REFERENCES companies(id)`);
      console.log('✅ Adicionada coluna company_id em officials');
    }
    
    if (!officialsColumnNames.includes('department_id')) {
      await db.execute(sql`ALTER TABLE officials ADD COLUMN department_id INTEGER REFERENCES departments(id)`);
      console.log('✅ Adicionada coluna department_id em officials');
    }
    
    if (!officialsColumnNames.includes('supervisor_id')) {
      await db.execute(sql`ALTER TABLE officials ADD COLUMN supervisor_id INTEGER`);
      console.log('✅ Adicionada coluna supervisor_id em officials');
    }
    
    if (!officialsColumnNames.includes('manager_id')) {
      await db.execute(sql`ALTER TABLE officials ADD COLUMN manager_id INTEGER`);
      console.log('✅ Adicionada coluna manager_id em officials');
    }

    // 4. Adicionar is_active na tabela incident_types se não existir
    console.log('📝 Atualizando tabela incident_types...');
    
    const incidentTypesColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incident_types' AND table_schema = 'public'
    `);
    
    const incidentTypesColumnNames = incidentTypesColumns.rows.map((row: any) => row.column_name);
    
    if (!incidentTypesColumnNames.includes('is_active')) {
      await db.execute(sql`ALTER TABLE incident_types ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true`);
      console.log('✅ Adicionada coluna is_active em incident_types');
    }

    // 5. Criar tabela user_notification_settings
    console.log('📝 Criando tabela user_notification_settings...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_notification_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Notificações de tickets
        new_ticket_assigned BOOLEAN DEFAULT true,
        ticket_status_changed BOOLEAN DEFAULT true,
        new_reply_received BOOLEAN DEFAULT true,
        ticket_escalated BOOLEAN DEFAULT true,
        ticket_due_soon BOOLEAN DEFAULT true,
        
        -- Notificações administrativas
        new_customer_registered BOOLEAN DEFAULT true,
        new_user_created BOOLEAN DEFAULT true,
        system_maintenance BOOLEAN DEFAULT true,
        
        -- Preferências de entrega
        email_notifications BOOLEAN DEFAULT true,
        
        -- Configurações de horário
        notification_hours_start INTEGER DEFAULT 9,
        notification_hours_end INTEGER DEFAULT 18,
        weekend_notifications BOOLEAN DEFAULT false,
        
        -- Configurações de frequência
        digest_frequency TEXT DEFAULT 'never' CHECK (digest_frequency IN ('never', 'daily', 'weekly')),
        
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ Tabela user_notification_settings criada');

    // 6. Criar tabela ticket_attachments
    console.log('📝 Criando tabela ticket_attachments...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        
        -- Informações do arquivo
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        
        -- Chaves do S3/Wasabi
        s3_key TEXT NOT NULL,
        s3_bucket TEXT NOT NULL,
        
        -- Metadados
        uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        deleted_at TIMESTAMP WITHOUT TIME ZONE,
        deleted_by_id INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Tabela ticket_attachments criada');

    // 7. Criar enum para tipos de templates de email
    console.log('📝 Criando enum email_template_type...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE email_template_type AS ENUM (
          'new_ticket',
          'ticket_assigned',
          'ticket_reply',
          'status_changed',
          'ticket_resolved',
          'ticket_escalated',
          'ticket_due_soon',
          'customer_registered',
          'user_created',
          'system_maintenance'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Enum email_template_type criado');

    // 8. Criar tabela email_templates
    console.log('📝 Criando tabela email_templates...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type email_template_type NOT NULL,
        description TEXT,
        
        -- Templates
        subject_template TEXT NOT NULL,
        html_template TEXT NOT NULL,
        text_template TEXT,
        
        -- Configurações
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        
        -- Variáveis disponíveis (JSON)
        available_variables TEXT,
        
        -- Multi-tenant
        company_id INTEGER REFERENCES companies(id),
        
        -- Metadados
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        created_by_id INTEGER REFERENCES users(id),
        updated_by_id INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Tabela email_templates criada');

    // 9. Criar enum para provedores de IA
    console.log('📝 Criando enum ai_provider...');
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE ai_provider AS ENUM (
          'openai',
          'google',
          'anthropic'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✅ Enum ai_provider criado');

    // 10. Criar tabela ai_configurations
    console.log('📝 Criando tabela ai_configurations...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_configurations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        provider ai_provider NOT NULL,
        model TEXT NOT NULL,
        api_key TEXT NOT NULL,
        api_endpoint TEXT,
        
        -- Configurações do prompt
        system_prompt TEXT NOT NULL,
        user_prompt_template TEXT NOT NULL,
        
        -- Configurações técnicas
        temperature TEXT DEFAULT '0.1',
        max_tokens INTEGER DEFAULT 100,
        timeout_seconds INTEGER DEFAULT 30,
        max_retries INTEGER DEFAULT 3,
        
        -- Configurações de fallback
        fallback_priority ticket_priority DEFAULT 'medium',
        
        -- Status
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_default BOOLEAN NOT NULL DEFAULT false,
        
        -- Multi-tenant
        company_id INTEGER REFERENCES companies(id),
        
        -- Metadados
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        created_by_id INTEGER REFERENCES users(id),
        updated_by_id INTEGER REFERENCES users(id)
      )
    `);
    console.log('✅ Tabela ai_configurations criada');

    // 11. Criar tabela ai_analysis_history
    console.log('📝 Criando tabela ai_analysis_history...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_analysis_history (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        ai_configuration_id INTEGER NOT NULL REFERENCES ai_configurations(id),
        
        -- Input da análise
        input_title TEXT NOT NULL,
        input_description TEXT NOT NULL,
        
        -- Output da IA
        suggested_priority ticket_priority NOT NULL,
        ai_response_raw TEXT,
        ai_justification TEXT,
        
        -- Metadados da requisição
        provider ai_provider NOT NULL,
        model TEXT NOT NULL,
        request_tokens INTEGER,
        response_tokens INTEGER,
        processing_time_ms INTEGER,
        
        -- Status da análise
        status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'fallback')),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        
        -- Multi-tenant
        company_id INTEGER REFERENCES companies(id),
        
        -- Timestamp
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ Tabela ai_analysis_history criada');

    // 12. Corrigir constraint única em system_settings
    console.log('📝 Corrigindo constraint única em system_settings...');
    
    // Remover constraint única existente se existir
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_unique;
      EXCEPTION
        WHEN undefined_object THEN null;
      END $$;
    `);
    
    // Criar nova constraint única composta
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_company_unique 
        UNIQUE (key, company_id);
      EXCEPTION
        WHEN duplicate_table THEN null;
      END $$;
    `);
    console.log('✅ Constraint única corrigida em system_settings');

    // 13. Criar tabela ticket_types se não existir
    console.log('📝 Criando tabela ticket_types...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        department_id INTEGER REFERENCES departments(id),
        company_id INTEGER REFERENCES companies(id),
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
        is_active BOOLEAN NOT NULL DEFAULT true
      )
    `);
    console.log('✅ Tabela ticket_types criada');

    // 14. Criar índices importantes para performance
    console.log('📝 Criando índices para performance...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON tickets(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets(assigned_to_id)',
      'CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_officials_company_id ON officials(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_system_settings_company_id ON system_settings(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_analysis_history_ticket_id ON ai_analysis_history(ticket_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_analysis_history_company_id ON ai_analysis_history(company_id)'
    ];
    
    for (const indexSql of indexes) {
      await db.execute(sql.raw(indexSql));
    }
    console.log('✅ Índices criados');

    console.log('🎉 Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
}

export async function down() {
  console.log('🔄 Revertendo migração...');
  
  try {
    // Reverter em ordem inversa
    
    // Remover índices
    console.log('📝 Removendo índices...');
    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_ai_analysis_history_company_id',
      'DROP INDEX IF EXISTS idx_ai_analysis_history_ticket_id',
      'DROP INDEX IF EXISTS idx_ticket_attachments_ticket_id',
      'DROP INDEX IF EXISTS idx_system_settings_company_id',
      'DROP INDEX IF EXISTS idx_departments_company_id',
      'DROP INDEX IF EXISTS idx_officials_company_id',
      'DROP INDEX IF EXISTS idx_customers_company_id',
      'DROP INDEX IF EXISTS idx_users_company_id',
      'DROP INDEX IF EXISTS idx_tickets_created_at',
      'DROP INDEX IF EXISTS idx_tickets_assigned_to_id',
      'DROP INDEX IF EXISTS idx_tickets_priority',
      'DROP INDEX IF EXISTS idx_tickets_status',
      'DROP INDEX IF EXISTS idx_tickets_company_id'
    ];
    
    for (const indexSql of dropIndexes) {
      await db.execute(sql.raw(indexSql));
    }
    
    // Remover tabelas criadas
    await db.execute(sql`DROP TABLE IF EXISTS ai_analysis_history CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ai_configurations CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS email_templates CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ticket_attachments CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS user_notification_settings CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ticket_types CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS departments CASCADE`);
    
    // Remover enums
    await db.execute(sql`DROP TYPE IF EXISTS ai_provider CASCADE`);
    await db.execute(sql`DROP TYPE IF EXISTS email_template_type CASCADE`);
    
    // Reverter constraint em system_settings
    await db.execute(sql`ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_key_company_unique`);
    await db.execute(sql`ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_unique UNIQUE (key)`);
    
    // Remover colunas adicionadas
    await db.execute(sql`ALTER TABLE officials DROP COLUMN IF EXISTS manager_id`);
    await db.execute(sql`ALTER TABLE officials DROP COLUMN IF EXISTS supervisor_id`);
    await db.execute(sql`ALTER TABLE officials DROP COLUMN IF EXISTS department_id`);
    await db.execute(sql`ALTER TABLE officials DROP COLUMN IF EXISTS company_id`);
    await db.execute(sql`ALTER TABLE incident_types DROP COLUMN IF EXISTS is_active`);
    
    // Reverter nomes das colunas em companies
    await db.execute(sql`ALTER TABLE companies RENAME COLUMN created_at TO "createdAt"`);
    await db.execute(sql`ALTER TABLE companies RENAME COLUMN updated_at TO "updatedAt"`);
    
    console.log('✅ Migração revertida');
    
  } catch (error) {
    console.error('❌ Erro ao reverter migração:', error);
    throw error;
  }
} 