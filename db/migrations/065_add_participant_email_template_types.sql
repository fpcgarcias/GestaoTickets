-- Migration: Adicionar tipos de template de email para participantes
-- Data: 2025-07-20

-- Adicionar novos valores ao enum email_template_type
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ticket_participant_added';
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ticket_participant_removed'; 