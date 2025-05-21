-- Criar tabela departments para armazenar departamentos
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id INTEGER REFERENCES companies(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Adicionar comentários para documentação
COMMENT ON TABLE departments IS 'Armazena os departamentos disponíveis no sistema';
COMMENT ON COLUMN departments.is_active IS 'Indica se o departamento está ativo ou inativo';

-- Criar índice para melhorar performance de consultas
CREATE INDEX idx_departments_company_id ON departments(company_id);

-- Popular com alguns departamentos padrão (opcional)
INSERT INTO departments (name, description, is_active)
VALUES 
  ('Suporte Técnico', 'Departamento responsável pelo suporte técnico', TRUE),
  ('Financeiro', 'Departamento responsável por questões financeiras', TRUE),
  ('Administrativo', 'Departamento responsável por questões administrativas', TRUE);

-- Executar este script com o comando:
-- psql -U seu_usuario -d seu_banco -f create-departments-table.sql 