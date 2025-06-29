-- Script para resolver IMEDIATAMENTE o problema dos Dept-null
-- Execute este script diretamente no banco de dados

-- 1. Verificar quais registros estão com problema
SELECT 
    od.id,
    od.official_id,
    od.department_id,
    o.name as official_name,
    o.email,
    o.company_id,
    d.name as department_name
FROM official_departments od
LEFT JOIN officials o ON o.id = od.official_id
LEFT JOIN departments d ON d.id = od.department_id
WHERE od.department_id IS NULL OR d.id IS NULL;

-- 2. DELETAR todos os registros com department_id NULL ou inválido
DELETE FROM official_departments 
WHERE department_id IS NULL 
   OR department_id NOT IN (SELECT id FROM departments);

-- 3. Para o Patrick Wallace especificamente, adicionar ao departamento TI (se existir)
-- Primeiro, verificar qual é o ID do departamento TI na empresa dele
WITH patrick_info AS (
    SELECT id, company_id 
    FROM officials 
    WHERE email = 'patrick.wallace@vixbrasil.com'
),
ti_dept AS (
    SELECT d.id 
    FROM departments d
    JOIN patrick_info p ON d.company_id = p.company_id
    WHERE d.name = 'TI' AND d.is_active = true
    LIMIT 1
)
INSERT INTO official_departments (official_id, department_id)
SELECT p.id, t.id
FROM patrick_info p
CROSS JOIN ti_dept t
WHERE NOT EXISTS (
    SELECT 1 FROM official_departments od 
    WHERE od.official_id = p.id AND od.department_id = t.id
);

-- 4. Verificar resultado final
SELECT 
    o.id,
    o.name,
    o.email,
    string_agg(d.name, ', ' ORDER BY d.name) as departments
FROM officials o
LEFT JOIN official_departments od ON od.official_id = o.id
LEFT JOIN departments d ON d.id = od.department_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.email
ORDER BY o.name; 