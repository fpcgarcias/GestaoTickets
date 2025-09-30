-- Migration: Add ticket_suggestions analysis_type
-- Created: 2025-01-03
-- Description: Adiciona o tipo de análise 'ticket_suggestions' para configurações de IA

-- Inserir configuração padrão para sugestões de tickets (global)
INSERT INTO ai_configurations (
  name,
  provider,
  model,
  system_prompt,
  user_prompt_template,
  temperature,
  max_tokens,
  timeout_seconds,
  max_retries,
  fallback_priority,
  company_id,
  department_id,
  analysis_type,
  is_active,
  is_default,
  created_at,
  updated_at
) VALUES (
  'Sugestões de Tickets - Global',
  'openai',
  'gpt-4',
  'Você é um assistente especializado em suporte técnico. Analise o ticket atual e os casos similares para sugerir uma resolução.',
  'TICKET ATUAL:
- Título: {ticket_title}
- Descrição: {ticket_description}
- Tipo: {ticket_type}
- Categoria: {ticket_category}
- Departamento: {department_name}

CASOS SIMILARES ENCONTRADOS ({similar_count}):
{similar_tickets_data}

INSTRUÇÕES:
1. Analise os casos similares e identifique padrões de resolução
2. Gere um passo a passo claro e objetivo
3. Inclua comandos específicos quando aplicável
4. Mantenha linguagem técnica mas acessível
5. Foque em soluções práticas e testáveis

FORMATO DE RESPOSTA (JSON):
{
  "summary": "Resumo da situação e abordagem sugerida",
  "confidence": 85,
  "step_by_step": [
    "Passo 1: Descrição detalhada",
    "Passo 2: Descrição detalhada"
  ],
  "commands": ["comando1", "comando2"],
  "additional_notes": "Observações importantes",
  "estimated_time": "15-30 minutos"
}',
  '0.1',
  1000,
  30,
  3,
  'MÉDIA',
  NULL, -- Global (todas as empresas)
  NULL, -- Global (todos os departamentos)
  'ticket_suggestions',
  true,
  true,
  NOW(),
  NOW()
);

-- Comentário para documentação
COMMENT ON COLUMN ai_configurations.analysis_type IS 'Tipo de análise: priority, reopen, ticket_suggestions';
