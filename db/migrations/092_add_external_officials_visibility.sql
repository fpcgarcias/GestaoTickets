-- Atendentes externos: flag e delegacao de visibilidade
ALTER TABLE officials ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS official_visibility_grants (
  id SERIAL PRIMARY KEY,
  observer_official_id INTEGER NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
  target_official_id INTEGER NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
  granted_by_user_id INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_official_visibility_grants_observer_target
  ON official_visibility_grants (observer_official_id, target_official_id);

CREATE INDEX IF NOT EXISTS idx_official_visibility_grants_observer
  ON official_visibility_grants (observer_official_id);
