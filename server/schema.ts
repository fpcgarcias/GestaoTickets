// Nova tabela para tipos de incidentes (ajustado para snake_case e adicionado value)
export const incidentTypes = pgTable("incident_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  department_id: integer("department_id"),
  company_id: integer("company_id").references(() => companies.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").default(true).notNull(),
}); 