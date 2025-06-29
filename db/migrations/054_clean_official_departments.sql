-- Migração para limpar dados incorretos da tabela official_departments
-- Remove registros com department_id null ou que não existem na tabela departments

BEGIN;

-- 1. Remover registros com department_id NULL
DELETE FROM official_departments 
WHERE department_id IS NULL;

-- 2. Remover registros onde department_id não existe na tabela departments
DELETE FROM official_departments od
WHERE NOT EXISTS (
    SELECT 1 FROM departments d 
    WHERE d.id = od.department_id
);

-- 3. Adicionar constraint de chave estrangeira para garantir integridade futura
-- Primeiro, remover a constraint se já existir
ALTER TABLE official_departments 
DROP CONSTRAINT IF EXISTS fk_official_departments_department_id;

-- Adicionar a constraint
ALTER TABLE official_departments
ADD CONSTRAINT fk_official_departments_department_id
FOREIGN KEY (department_id) 
REFERENCES departments(id)
ON DELETE CASCADE;

-- 4. Adicionar constraint para official_id também
ALTER TABLE official_departments 
DROP CONSTRAINT IF EXISTS fk_official_departments_official_id;

ALTER TABLE official_departments
ADD CONSTRAINT fk_official_departments_official_id
FOREIGN KEY (official_id) 
REFERENCES officials(id)
ON DELETE CASCADE;

-- 5. Garantir que department_id nunca seja NULL
ALTER TABLE official_departments
ALTER COLUMN department_id SET NOT NULL;

COMMIT; 