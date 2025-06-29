-- Script para corrigir departamentos do Patrick Wallace

-- 1. Verificar a situação atual
SELECT 
    od.*,
    o.name as official_name,
    d.name as department_name
FROM official_departments od
LEFT JOIN officials o ON o.id = od.official_id
LEFT JOIN departments d ON d.id = od.department_id
WHERE o.email = 'patrick.wallace@vixbrasil.com';

-- 2. Remover todos os registros com department_id null ou inválido
DELETE FROM official_departments 
WHERE official_id = (SELECT id FROM officials WHERE email = 'patrick.wallace@vixbrasil.com')
AND (department_id IS NULL OR department_id NOT IN (SELECT id FROM departments));

-- 3. Verificar quais departamentos estão disponíveis para a empresa
SELECT * FROM departments 
WHERE company_id = (SELECT company_id FROM officials WHERE email = 'patrick.wallace@vixbrasil.com')
AND is_active = true;

-- 4. Se necessário, adicionar o departamento correto (ajuste o department_id conforme necessário)
-- Exemplo: Se TI tem id=1
/*
INSERT INTO official_departments (official_id, department_id) 
VALUES (
    (SELECT id FROM officials WHERE email = 'patrick.wallace@vixbrasil.com'),
    1  -- ID do departamento TI
);
*/ 