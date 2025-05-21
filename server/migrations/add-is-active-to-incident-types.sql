-- Adicionar a coluna is_active à tabela incident_types
ALTER TABLE incident_types ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Atualizar valores existentes (opcional)
-- UPDATE incident_types SET is_active = TRUE;

-- Adicionar comentário para documentação
COMMENT ON COLUMN incident_types.is_active IS 'Indica se o tipo de chamado está ativo ou inativo';

-- Executar este script com o comando:
-- psql -U seu_usuario -d seu_banco -f add-is-active-to-incident-types.sql 