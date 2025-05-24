import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando enum e tabelas para configuração de IA');

  // Criar enum para provedores de IA
  await db.execute(sql`
    CREATE TYPE ai_provider AS ENUM (
      'openai',
      'google', 
      'anthropic'
    );
  `);

  // Criar tabela ai_configurations
  await db.execute(sql`
    CREATE TABLE ai_configurations (
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
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      
      -- Multi-tenant
      company_id INTEGER REFERENCES companies(id),
      
      -- Metadados
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      created_by_id INTEGER REFERENCES users(id),
      updated_by_id INTEGER REFERENCES users(id)
    );
  `);

  // Criar tabela ai_analysis_history
  await db.execute(sql`
    CREATE TABLE ai_analysis_history (
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
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // Criar índices para performance
  await db.execute(sql`
    CREATE INDEX idx_ai_configurations_company_id ON ai_configurations(company_id);
    CREATE INDEX idx_ai_configurations_active ON ai_configurations(is_active);
    CREATE INDEX idx_ai_configurations_default ON ai_configurations(is_default);
    
    CREATE INDEX idx_ai_analysis_history_ticket_id ON ai_analysis_history(ticket_id);
    CREATE INDEX idx_ai_analysis_history_company_id ON ai_analysis_history(company_id);
    CREATE INDEX idx_ai_analysis_history_created_at ON ai_analysis_history(created_at);
    CREATE INDEX idx_ai_analysis_history_status ON ai_analysis_history(status);
  `);

  // Constraint para garantir apenas uma configuração padrão por empresa
  await db.execute(sql`
    CREATE UNIQUE INDEX idx_ai_configurations_default_per_company 
    ON ai_configurations(company_id) 
    WHERE is_default = TRUE AND is_active = TRUE;
  `);

  // Criar trigger para atualizar updated_at nas configurações de IA
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION update_ai_configurations_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await db.execute(sql`
    CREATE TRIGGER trigger_update_ai_configurations_updated_at
        BEFORE UPDATE ON ai_configurations
        FOR EACH ROW
        EXECUTE FUNCTION update_ai_configurations_updated_at();
  `);

  // Inserir configuração padrão de exemplo (OpenAI)
  await db.execute(sql`
    INSERT INTO ai_configurations (
      name, provider, model, api_key, system_prompt, user_prompt_template,
      temperature, max_tokens, timeout_seconds, is_active, is_default
    ) VALUES (
      'Configuração Padrão OpenAI',
      'openai',
      'gpt-4o',
      'YOUR_API_KEY_HERE',
      'Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade apropriada baseada nos seguintes critérios:

CRITICAL: Sistemas completamente fora do ar, falhas de segurança críticas, perda de dados, problemas que afetam múltiplos usuários imediatamente e impedem operações essenciais.

HIGH: Funcionalidades principais não funcionando, problemas que impedem trabalho de usuários específicos, deadlines próximos sendo impactados, falhas que afetam produtividade significativamente.

MEDIUM: Problemas que causam inconveniência mas têm soluções alternativas, funcionalidades secundárias não funcionando, solicitações de melhorias importantes mas não urgentes.

LOW: Dúvidas simples, solicitações de treinamento, melhorias estéticas, configurações pessoais, problemas que não impedem o trabalho.

ATENÇÃO: Responda APENAS com uma das palavras exatas: critical, high, medium ou low (sempre em minúsculas e em inglês).',
      'Título: {titulo}

Descrição: {descricao}

Prioridade:',
      '0.1',
      100,
      30,
      FALSE,
      FALSE
    );
  `);

  console.log('Migration ai_configurations concluída com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo tabelas de configuração de IA');
  
  await db.execute(sql`DROP TRIGGER IF EXISTS trigger_update_ai_configurations_updated_at ON ai_configurations;`);
  await db.execute(sql`DROP FUNCTION IF EXISTS update_ai_configurations_updated_at();`);
  await db.execute(sql`DROP TABLE IF EXISTS ai_analysis_history CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS ai_configurations CASCADE;`);
  await db.execute(sql`DROP TYPE IF EXISTS ai_provider CASCADE;`);
  
  console.log('Rollback ai_configurations concluído');
} 