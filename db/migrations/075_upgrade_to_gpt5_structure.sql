-- Migration 075: Upgrade AI configurations to GPT-5 structure
-- Adds GPT-5 specific parameters and removes incompatible fields

-- Add new GPT-5 specific columns
ALTER TABLE ai_configurations 
ADD COLUMN reasoning_effort TEXT DEFAULT 'medium' CHECK (reasoning_effort IN ('minimal', 'low', 'medium', 'high'));

ALTER TABLE ai_configurations 
ADD COLUMN verbosity TEXT DEFAULT 'medium' CHECK (verbosity IN ('low', 'medium', 'high'));

-- Rename max_tokens to max_completion_tokens for GPT-5 compatibility
ALTER TABLE ai_configurations 
ADD COLUMN max_completion_tokens INTEGER;

-- Copy existing max_tokens values to max_completion_tokens
UPDATE ai_configurations 
SET max_completion_tokens = max_tokens 
WHERE max_tokens IS NOT NULL;

-- Set default for max_completion_tokens where it's null
UPDATE ai_configurations 
SET max_completion_tokens = 1500 
WHERE max_completion_tokens IS NULL;

-- Make max_completion_tokens NOT NULL with default
ALTER TABLE ai_configurations 
ALTER COLUMN max_completion_tokens SET NOT NULL,
ALTER COLUMN max_completion_tokens SET DEFAULT 1500;

-- Update existing GPT-4 models to GPT-5 equivalents
UPDATE ai_configurations 
SET model = CASE 
    WHEN model = 'gpt-4o-mini' THEN 'gpt-5-mini'
    WHEN model = 'gpt-4o' THEN 'gpt-5'
    WHEN model = 'gpt-4-turbo' THEN 'gpt-5'
    WHEN model = 'gpt-4' THEN 'gpt-5'
    WHEN model = 'gpt-3.5-turbo' THEN 'gpt-5-mini'
    ELSE model
END
WHERE provider = 'openai' AND model LIKE 'gpt-%';

-- Remove temperature field as GPT-5 doesn't support it (it's forced to 1)
-- We'll keep the column for backward compatibility but it won't be used
UPDATE ai_configurations 
SET temperature = '1' 
WHERE provider = 'openai' AND model LIKE 'gpt-5%';

-- Update timeout_seconds to 60 seconds for GPT-5 models (they need more time for reasoning)
UPDATE ai_configurations 
SET timeout_seconds = 60 
WHERE provider = 'openai' AND model LIKE 'gpt-5%';

-- Add comment to temperature column indicating it's not used for GPT-5
COMMENT ON COLUMN ai_configurations.temperature IS 'Temperature setting - Not used for GPT-5 models (forced to 1)';

-- Add comments for new columns
COMMENT ON COLUMN ai_configurations.reasoning_effort IS 'GPT-5 reasoning effort level: minimal, low, medium, high';
COMMENT ON COLUMN ai_configurations.verbosity IS 'GPT-5 verbosity level: low, medium, high';
COMMENT ON COLUMN ai_configurations.max_completion_tokens IS 'Maximum completion tokens for GPT-5 (replaces max_tokens)';

-- Create index for better performance on GPT-5 specific queries
CREATE INDEX IF NOT EXISTS idx_ai_configurations_gpt5_params 
ON ai_configurations(provider, model, reasoning_effort, verbosity) 
WHERE provider = 'openai' AND model LIKE 'gpt-5%';

-- Insert new GPT-5 models into system_settings
-- Note: Since system_settings has unique constraint only on 'key', we need to handle this differently
-- First, check if the key already exists, if not, insert the first GPT-5 model as default
INSERT INTO system_settings (key, value, company_id)
SELECT 'ai_openai_model', 'gpt-5', NULL
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'ai_openai_model');

-- Remove old GPT-4 models from system_settings (optional - uncomment if you want to remove them)
-- DELETE FROM system_settings 
-- WHERE key = 'ai_openai_model' 
-- AND value IN ('gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo');