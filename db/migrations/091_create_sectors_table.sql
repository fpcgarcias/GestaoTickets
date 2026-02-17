CREATE TABLE IF NOT EXISTS sectors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  company_id INTEGER REFERENCES companies(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES sectors(id);
