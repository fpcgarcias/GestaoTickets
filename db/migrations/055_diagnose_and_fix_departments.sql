-- Script de diagnóstico e correção de departamentos
-- Execute este script para verificar e corrigir problemas com departamentos

-- 1. Verificar registros problemáticos em official_departments
SELECT 
    od.id,
    od.official_id,
    od.department_id,
    o.name as official_name,
    d.name as department_name,
    CASE 
        WHEN od.department_id IS NULL THEN 'department_id NULL'
        WHEN d.id IS NULL THEN 'department não existe'
        ELSE 'OK'
    END as status
FROM official_departments od
LEFT JOIN officials o ON o.id = od.official_id
LEFT JOIN departments d ON d.id = od.department_id
WHERE od.department_id IS NULL OR d.id IS NULL;

-- 2. Mostrar todos os departamentos disponíveis
SELECT id, name, company_id, is_active 
FROM departments 
WHERE is_active = true
ORDER BY company_id, name;

-- 3. Limpar registros órfãos (sem official correspondente)
DELETE FROM official_departments od
WHERE NOT EXISTS (
    SELECT 1 FROM officials o 
    WHERE o.id = od.official_id
);

-- 4. Para cada official, mostrar seus departamentos atuais
SELECT 
    o.id as official_id,
    o.name as official_name,
    o.email,
    o.company_id,
    string_agg(d.name, ', ') as departments
FROM officials o
LEFT JOIN official_departments od ON od.official_id = o.id
LEFT JOIN departments d ON d.id = od.department_id
WHERE o.is_active = true
GROUP BY o.id, o.name, o.email, o.company_id
ORDER BY o.company_id, o.name;

-- 5. Sugestão de correção manual para atendentes sem departamento
-- (Ajuste os IDs conforme necessário)
/*
-- Exemplo: Adicionar departamento TI (id=1) ao atendente Patrick Wallace (id=12)
INSERT INTO official_departments (official_id, department_id) 
VALUES (12, 1);

-- Remover todos os departamentos inválidos de um atendente específico
DELETE FROM official_departments 
WHERE official_id = 12 AND (department_id IS NULL OR department_id NOT IN (SELECT id FROM departments));
*/ 