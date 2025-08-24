-- Add assignment change tracking to ticket_status_history

-- Columns to record transfers between attendants (officials)
ALTER TABLE ticket_status_history
  ADD COLUMN IF NOT EXISTS old_assigned_to_id integer REFERENCES officials(id),
  ADD COLUMN IF NOT EXISTS new_assigned_to_id integer REFERENCES officials(id);

-- Helpful composite index for queries by ticket and type
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_assignment
  ON ticket_status_history(ticket_id)
  WHERE change_type = 'assignment';

COMMENT ON COLUMN ticket_status_history.old_assigned_to_id IS 'Atendente anterior (apenas para change_type = assignment)';
COMMENT ON COLUMN ticket_status_history.new_assigned_to_id IS 'Novo atendente (apenas para change_type = assignment)';


