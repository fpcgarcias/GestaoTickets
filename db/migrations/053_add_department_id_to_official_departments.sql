-- Adicionar coluna department_id à tabela official_departments
-- Já que a coluna department foi removida, precisamos apenas adicionar department_id

-- 1. Adicionar coluna department_id (nullable por enquanto)
ALTER TABLE official_departments 
ADD COLUMN department_id INTEGER;

-- 2. Adicionar foreign key constraint
ALTER TABLE official_departments 
ADD CONSTRAINT official_departments_department_id_fkey 
FOREIGN KEY (department_id) REFERENCES departments(id);

-- NOTA: Os valores de department_id precisarão ser populados manualmente
-- ou via interface administrativa, já que os dados originais foram perdidos