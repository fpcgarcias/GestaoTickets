-- Remove o campo api_key da tabela ai_configurations
-- O token será gerenciado centralmente via system_settings
ALTER TABLE ai_configurations
  DROP COLUMN IF EXISTS api_key;

-- Adiciona comentário explicativo
COMMENT ON TABLE ai_configurations IS 'Configurações de IA por empresa/departamento. Tokens gerenciados via system_settings.'; 