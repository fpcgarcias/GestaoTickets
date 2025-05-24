import { sql } from 'drizzle-orm';
import { db } from '../db';

export async function up() {
  console.log('Migrando: Criando enum e tabela email_templates');

  // Criar enum para tipos de templates de email
  await db.execute(sql`
    CREATE TYPE email_template_type AS ENUM (
      'new_ticket',
      'ticket_assigned', 
      'ticket_reply',
      'status_changed',
      'ticket_resolved',
      'ticket_escalated',
      'ticket_due_soon',
      'customer_registered',
      'user_created',
      'system_maintenance'
    );
  `);

  // Criar tabela email_templates
  await db.execute(sql`
    CREATE TABLE email_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type email_template_type NOT NULL,
      description TEXT,
      
      -- Templates
      subject_template TEXT NOT NULL,
      html_template TEXT NOT NULL,
      text_template TEXT,
      
      -- Configurações
      is_active BOOLEAN DEFAULT TRUE NOT NULL,
      is_default BOOLEAN DEFAULT FALSE NOT NULL,
      
      -- Variáveis disponíveis (JSON)
      available_variables TEXT,
      
      -- Multi-tenant
      company_id INTEGER REFERENCES companies(id),
      
      -- Metadados
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
      created_by_id INTEGER REFERENCES users(id),
      updated_by_id INTEGER REFERENCES users(id)
    );
  `);

  // Criar índices
  await db.execute(sql`
    CREATE INDEX idx_email_templates_type ON email_templates(type);
    CREATE INDEX idx_email_templates_company_id ON email_templates(company_id);
    CREATE INDEX idx_email_templates_is_active ON email_templates(is_active);
    CREATE UNIQUE INDEX idx_email_templates_default_per_type_company 
      ON email_templates(type, company_id) 
      WHERE is_default = TRUE;
  `);

  // Inserir templates padrão
  await db.execute(sql`
    INSERT INTO email_templates (
      name, type, description, subject_template, html_template, text_template, 
      is_active, is_default, available_variables
    ) VALUES 
    (
      'Novo Ticket - Template Padrão',
      'new_ticket',
      'Template padrão para notificação de novo ticket criado',
      'Novo Ticket Criado: {{ticket.title}}',
      '<h2>Novo Ticket Criado</h2>
       <p><strong>Ticket:</strong> {{ticket.ticket_id}}</p>
       <p><strong>Título:</strong> {{ticket.title}}</p>
       <p><strong>Cliente:</strong> {{customer.name}} ({{customer.email}})</p>
       <p><strong>Prioridade:</strong> {{ticket.priority}}</p>
       <p><strong>Descrição:</strong></p>
       <p>{{ticket.description}}</p>
       <hr>
       <p><a href="{{system.base_url}}/tickets/{{ticket.id}}">Ver Ticket</a></p>',
      'Novo Ticket Criado
       
       Ticket: {{ticket.ticket_id}}
       Título: {{ticket.title}}
       Cliente: {{customer.name}} ({{customer.email}})
       Prioridade: {{ticket.priority}}
       
       Descrição:
       {{ticket.description}}
       
       Ver ticket: {{system.base_url}}/tickets/{{ticket.id}}',
      TRUE,
      TRUE,
      '{"ticket": ["id", "ticket_id", "title", "description", "priority", "status", "type"], "customer": ["name", "email", "company"], "system": ["base_url", "company_name"]}'
    ),
    (
      'Resposta no Ticket - Template Padrão',
      'ticket_reply',
      'Template padrão para notificação de nova resposta em ticket',
      'Nova Resposta no Ticket: {{ticket.title}}',
      '<h2>Nova Resposta no Ticket</h2>
       <p><strong>Ticket:</strong> {{ticket.ticket_id}} - {{ticket.title}}</p>
       <p><strong>Respondido por:</strong> {{reply.user.name}}</p>
       <p><strong>Data:</strong> {{reply.created_at}}</p>
       <p><strong>Mensagem:</strong></p>
       <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #007bff;">
         {{reply.message}}
       </div>
       <hr>
       <p><a href="{{system.base_url}}/tickets/{{ticket.id}}">Ver Ticket</a></p>',
      'Nova Resposta no Ticket
       
       Ticket: {{ticket.ticket_id}} - {{ticket.title}}
       Respondido por: {{reply.user.name}}
       Data: {{reply.created_at}}
       
       Mensagem:
       {{reply.message}}
       
       Ver ticket: {{system.base_url}}/tickets/{{ticket.id}}',
      TRUE,
      TRUE,
      '{"ticket": ["id", "ticket_id", "title"], "reply": ["message", "created_at"], "reply.user": ["name", "email"], "system": ["base_url", "company_name"]}'
    ),
    (
      'Status Alterado - Template Padrão',
      'status_changed',
      'Template padrão para notificação de mudança de status',
      'Ticket {{ticket.ticket_id}}: Status alterado para {{ticket.status}}',
      '<h2>Status do Ticket Alterado</h2>
       <p><strong>Ticket:</strong> {{ticket.ticket_id}} - {{ticket.title}}</p>
       <p><strong>Status anterior:</strong> {{status_change.old_status}}</p>
       <p><strong>Novo status:</strong> {{status_change.new_status}}</p>
       <p><strong>Alterado por:</strong> {{status_change.changed_by.name}}</p>
       <p><strong>Data:</strong> {{status_change.created_at}}</p>
       <hr>
       <p><a href="{{system.base_url}}/tickets/{{ticket.id}}">Ver Ticket</a></p>',
      'Status do Ticket Alterado
       
       Ticket: {{ticket.ticket_id}} - {{ticket.title}}
       Status anterior: {{status_change.old_status}}
       Novo status: {{status_change.new_status}}
       Alterado por: {{status_change.changed_by.name}}
       Data: {{status_change.created_at}}
       
       Ver ticket: {{system.base_url}}/tickets/{{ticket.id}}',
      TRUE,
      TRUE,
      '{"ticket": ["id", "ticket_id", "title", "status"], "status_change": ["old_status", "new_status", "created_at"], "status_change.changed_by": ["name"], "system": ["base_url", "company_name"]}'
    );
  `);

  console.log('Migration email_templates concluída com sucesso');
}

export async function down() {
  console.log('Revertendo: Removendo tabela email_templates');
  
  await db.execute(sql`DROP TABLE IF EXISTS email_templates CASCADE;`);
  await db.execute(sql`DROP TYPE IF EXISTS email_template_type CASCADE;`);
  
  console.log('Rollback email_templates concluído');
} 