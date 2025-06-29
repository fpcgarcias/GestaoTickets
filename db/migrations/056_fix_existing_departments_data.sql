-- Migração para corrigir dados existentes de departamentos
-- Esta migração deve ser executada ANTES da aplicação de constraints

BEGIN;

-- 1. Criar tabela temporária para backup dos dados atuais
CREATE TEMP TABLE temp_official_departments_backup AS
SELECT * FROM official_departments;

-- 2. Identificar e remover registros com department_id NULL
DELETE FROM official_departments 
WHERE department_id IS NULL;

-- 3. Remover registros onde department_id não existe na tabela departments
DELETE FROM official_departments od
WHERE NOT EXISTS (
    SELECT 1 FROM departments d 
    WHERE d.id = od.department_id
);

-- 4. Para atendentes sem nenhum departamento válido, adicionar ao departamento padrão da empresa
INSERT INTO official_departments (official_id, department_id)
SELECT DISTINCT o.id, 
       COALESCE(
           -- Tenta usar o department_id do campo department_id da tabela officials
           o.department_id,
           -- Se não tiver, pega o primeiro departamento ativo da empresa
           (SELECT id FROM departments 
            WHERE company_id = o.company_id 
            AND is_active = true 
            ORDER BY id 
            LIMIT 1)
       )
FROM officials o
WHERE o.is_active = true
AND NOT EXISTS (
    SELECT 1 FROM official_departments od 
    WHERE od.official_id = o.id
)
AND (o.department_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM departments 
    WHERE company_id = o.company_id 
    AND is_active = true
));

-- 5. Relatório de mudanças
SELECT 
    'Registros removidos (department_id NULL)' as acao,
    COUNT(*) as quantidade
FROM temp_official_departments_backup
WHERE department_id IS NULL

UNION ALL

SELECT 
    'Registros removidos (department não existe)' as acao,
    COUNT(*) as quantidade
FROM temp_official_departments_backup t
WHERE NOT EXISTS (
    SELECT 1 FROM departments d 
    WHERE d.id = t.department_id
)

UNION ALL

SELECT 
    'Atendentes que receberam departamento padrão' as acao,
    COUNT(DISTINCT o.id) as quantidade
FROM officials o
WHERE o.is_active = true
AND NOT EXISTS (
    SELECT 1 FROM temp_official_departments_backup t 
    WHERE t.official_id = o.id
)
AND EXISTS (
    SELECT 1 FROM official_departments od 
    WHERE od.official_id = o.id
);

COMMIT; 