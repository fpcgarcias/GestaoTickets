-- Remove coluna 'department' da tabela official_departments
-- Mantém apenas official_id e department_id (IDs)

ALTER TABLE official_departments DROP COLUMN IF EXISTS department; 