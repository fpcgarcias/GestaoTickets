-- Índices para reduzir latência de consultas em autenticação, tickets e dashboard

-- tickets: filtros frequentes em dashboard/listagens
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_department_id ON tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_id ON tickets(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_incident_type_id ON tickets(incident_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_company_dept_status ON tickets(company_id, department_id, status);

-- ticket_participants: lookup por ticket e verificação de participação
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket_id ON ticket_participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_participants_user_id ON ticket_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_participants_ticket_user ON ticket_participants(ticket_id, user_id);

-- histórico e respostas de ticket
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_id ON ticket_status_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- incident_types: filtros por empresa/departamento/ativo
CREATE INDEX IF NOT EXISTS idx_incident_types_company_id ON incident_types(company_id);
CREATE INDEX IF NOT EXISTS idx_incident_types_department_id ON incident_types(department_id);
CREATE INDEX IF NOT EXISTS idx_incident_types_is_active ON incident_types(is_active);

-- customers: lookup por usuário e empresa
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- officials: filtros de hierarquia e escopo
CREATE INDEX IF NOT EXISTS idx_officials_user_id ON officials(user_id);
CREATE INDEX IF NOT EXISTS idx_officials_company_id ON officials(company_id);
CREATE INDEX IF NOT EXISTS idx_officials_supervisor_id ON officials(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_officials_manager_id ON officials(manager_id);
CREATE INDEX IF NOT EXISTS idx_officials_department_id ON officials(department_id);

-- official_departments: associação oficial <-> departamento
CREATE INDEX IF NOT EXISTS idx_official_departments_official_id ON official_departments(official_id);
CREATE INDEX IF NOT EXISTS idx_official_departments_department_id ON official_departments(department_id);
