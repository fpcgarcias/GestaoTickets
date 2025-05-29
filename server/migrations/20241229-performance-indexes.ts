import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function up() {
  console.log('🚀 Aplicando índices de performance...');
  
  try {
    // Índices para tabela tickets (principais consultas)
    // Status: 'new', 'ongoing', 'resolved' | Priority: 'low', 'medium', 'high', 'critical'
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_status_priority 
      ON tickets(status, priority);
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_status 
      ON tickets(company_id, status) 
      WHERE company_id IS NOT NULL;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assigned_status 
      ON tickets(assigned_to_id, status) 
      WHERE assigned_to_id IS NOT NULL;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_desc 
      ON tickets(created_at DESC);
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_company_created 
      ON tickets(company_id, created_at DESC) 
      WHERE company_id IS NOT NULL;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_department_status 
      ON tickets(department_id, status) 
      WHERE department_id IS NOT NULL;
    `);
    
    // Índices para tabela ticket_replies
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_replies_ticket_created 
      ON ticket_replies(ticket_id, created_at DESC);
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_replies_user_created 
      ON ticket_replies(user_id, created_at DESC) 
      WHERE user_id IS NOT NULL;
    `);
    
    // Índices para tabela users
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
      ON users(email) 
      WHERE active = true;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_active 
      ON users(username) 
      WHERE active = true;
    `);
    
    // Roles: 'admin', 'customer', 'support', 'manager', 'supervisor', 'viewer', 'company_admin', 'triage', 'quality', 'integration_bot'
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_role 
      ON users(company_id, role) 
      WHERE company_id IS NOT NULL AND active = true;
    `);
    
    // Índices para tabela customers
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email 
      ON customers(email);
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_company_created 
      ON customers(company_id, created_at DESC) 
      WHERE company_id IS NOT NULL;
    `);
    
    // Índices para tabela officials
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_officials_company_active 
      ON officials(company_id, is_active) 
      WHERE company_id IS NOT NULL;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_officials_user_id 
      ON officials(user_id) 
      WHERE user_id IS NOT NULL;
    `);
    
    // Índices para tabela departments
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_company_active 
      ON departments(company_id, is_active) 
      WHERE company_id IS NOT NULL;
    `);
    
    // Índices para tabela incident_types
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_types_company_active 
      ON incident_types(company_id, is_active) 
      WHERE company_id IS NOT NULL;
    `);
    
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incident_types_global_active 
      ON incident_types(is_active) 
      WHERE company_id IS NULL;
    `);
    
    // Índices para tabela ticket_attachments
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_attachments_ticket_active 
      ON ticket_attachments(ticket_id, uploaded_at DESC) 
      WHERE is_deleted = false;
    `);
    
    // Índices para tabela ticket_status_history
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_status_history_ticket_created 
      ON ticket_status_history(ticket_id, created_at DESC);
    `);
    
    // Índices para tabela sla_definitions
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sla_definitions_company_priority 
      ON sla_definitions(company_id, priority);
    `);
    
    console.log('✅ Índices de performance aplicados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar índices de performance:', error);
    throw error;
  }
}

export async function down() {
  console.log('🔄 Removendo índices de performance...');
  
  try {
    // Remover todos os índices criados
    const indexes = [
      'idx_tickets_status_priority',
      'idx_tickets_company_status', 
      'idx_tickets_assigned_status',
      'idx_tickets_created_desc',
      'idx_tickets_company_created',
      'idx_tickets_department_status',
      'idx_ticket_replies_ticket_created',
      'idx_ticket_replies_user_created',
      'idx_users_email_active',
      'idx_users_username_active',
      'idx_users_company_role',
      'idx_customers_email',
      'idx_customers_company_created',
      'idx_officials_company_active',
      'idx_officials_user_id',
      'idx_departments_company_active',
      'idx_incident_types_company_active',
      'idx_incident_types_global_active',
      'idx_ticket_attachments_ticket_active',
      'idx_ticket_status_history_ticket_created',
      'idx_sla_definitions_company_priority'
    ];
    
    for (const indexName of indexes) {
      await db.execute(sql`DROP INDEX IF EXISTS ${sql.identifier(indexName)};`);
    }
    
    console.log('✅ Índices de performance removidos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao remover índices de performance:', error);
    throw error;
  }
} 