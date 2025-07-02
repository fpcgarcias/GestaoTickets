-- Migration 059: Configurações de IA por Departamento
-- Adiciona suporte para configurações de IA específicas por departamento

-- Adicionar coluna department_id na tabela ai_configurations
ALTER TABLE ai_configurations ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_ai_configurations_department ON ai_configurations(department_id);

-- Adicionar constraint única para evitar múltiplas configurações padrão por departamento
-- Remover a constraint global is_default primeiro se existir
ALTER TABLE ai_configurations DROP CONSTRAINT IF EXISTS ai_configurations_unique_default;

-- Criar nova constraint que permite apenas uma configuração padrão por departamento (ou global se department_id for NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_configurations_unique_default_per_dept 
ON ai_configurations (COALESCE(department_id, 0), is_default) 
WHERE is_default = true;

-- Comentários para documentação
COMMENT ON COLUMN ai_configurations.department_id IS 'ID do departamento (NULL = configuração global para todos os departamentos)';
COMMENT ON TABLE ai_configurations IS 'Configurações de IA por departamento ou globais (quando department_id é NULL)';

-- Inserir configuração padrão global se não existir nenhuma
INSERT INTO ai_configurations (
  name, 
  provider, 
  model, 
  api_key, 
  system_prompt, 
  user_prompt_template,
  department_id,
  is_active,
  is_default
)
SELECT 
  'Configuração Padrão Global',
  'openai',
  'gpt-4o',
  'YOUR_API_KEY_HERE',
  'Você é um assistente especializado em análise de prioridade de tickets de suporte técnico. Analise o título e descrição do ticket e determine a prioridade baseada na urgência e impacto. Responda apenas com uma das seguintes opções: low, medium, high, critical.',
  'Título: {titulo}
Descrição: {descricao}

Analise este ticket e determine sua prioridade considerando:
- Urgência: Quão rapidamente precisa ser resolvido?
- Impacto: Quantas pessoas/sistemas são afetados?
- Criticidade: Afeta operações essenciais?

Responda apenas com: low, medium, high ou critical',
  NULL, -- Configuração global
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM ai_configurations WHERE is_default = true); 