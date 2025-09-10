-- Migration: Add department/type/category transfer tracking to ticket_status_history

-- Add columns to record transfers between departments/types/categories
ALTER TABLE ticket_status_history
  ADD COLUMN IF NOT EXISTS old_department_id integer REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS new_department_id integer REFERENCES departments(id),
  ADD COLUMN IF NOT EXISTS old_incident_type_id integer REFERENCES incident_types(id),
  ADD COLUMN IF NOT EXISTS new_incident_type_id integer REFERENCES incident_types(id),
  ADD COLUMN IF NOT EXISTS old_category_id integer REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS new_category_id integer REFERENCES categories(id);

-- Helpful partial index for department change events
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_department
  ON ticket_status_history(ticket_id)
  WHERE change_type = 'department';

COMMENT ON COLUMN ticket_status_history.old_department_id IS 'Departamento anterior (apenas para change_type = department)';
COMMENT ON COLUMN ticket_status_history.new_department_id IS 'Novo departamento (apenas para change_type = department)';
COMMENT ON COLUMN ticket_status_history.old_incident_type_id IS 'Tipo de chamado anterior (apenas para change_type = department)';
COMMENT ON COLUMN ticket_status_history.new_incident_type_id IS 'Novo tipo de chamado (apenas para change_type = department)';
COMMENT ON COLUMN ticket_status_history.old_category_id IS 'Categoria anterior (apenas para change_type = department)';
COMMENT ON COLUMN ticket_status_history.new_category_id IS 'Nova categoria (apenas para change_type = department)';



