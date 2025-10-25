-- 072_add_satisfaction_survey_reminder_flags.sql
-- Adiciona flags para controle de lembretes da pesquisa de satisfação

-- O valor 'satisfaction_survey_reminder' já existe no enum email_template_type
-- ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'satisfaction_survey_reminder';

-- As colunas já existem no schema, então esta migração não é mais necessária
-- ALTER TABLE satisfaction_surveys
--   ADD COLUMN IF NOT EXISTS reminder_5d_sent BOOLEAN NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS reminder_3d_sent BOOLEAN NOT NULL DEFAULT false,
--   ADD COLUMN IF NOT EXISTS reminder_1d_sent BOOLEAN NOT NULL DEFAULT false;

-- COMMENT ON COLUMN satisfaction_surveys.reminder_5d_sent IS 'Indica se o lembrete de 5 dias antes da expiracao foi enviado';
-- COMMENT ON COLUMN satisfaction_surveys.reminder_3d_sent IS 'Indica se o lembrete de 3 dias antes da expiracao foi enviado';
-- COMMENT ON COLUMN satisfaction_surveys.reminder_1d_sent IS 'Indica se o lembrete de 1 dia antes da expiracao foi enviado';

-- Esta migração foi aplicada via schema.ts, então não é mais necessária
SELECT 1; -- Migração vazia para manter a numeração

