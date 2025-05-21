-- Migração para atualizar o enum user_role adicionando novos roles
-- No PostgreSQL, para adicionar novos valores a um ENUM existente, usamos ALTER TYPE

-- Adicionar os novos valores ao enum
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'triage';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'quality';
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'integration_bot';

-- Comentários sobre os roles
COMMENT ON TYPE "public"."user_role" IS 'Enum de papéis de usuário:
- admin: Acesso total ao sistema, multiempresa
- customer: Cliente da empresa
- support: Atendente
- manager: Gestor da equipe
- supervisor: Nível entre manager e support
- viewer: Apenas visualização de chamados
- company_admin: Admin local da empresa
- triage: Classificação e encaminhamento
- quality: Avaliação de qualidade
- integration_bot: Bots e integrações'; 