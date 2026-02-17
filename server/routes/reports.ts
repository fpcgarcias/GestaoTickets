import { Router } from 'express';
import { Request, Response } from 'express';
import { authRequired } from '../middleware/authorization';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, and, or, gte, lte, isNull, inArray, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import puppeteer from 'puppeteer';
import { getBusinessHoursConfig } from '@shared/utils/sla-calculator';
import { type TicketStatus } from '@shared/ticket-utils';
import { storage } from '../storage';
import { withTimeout } from '../middleware/file-validation';
import { logger } from '../services/logger';

const router = Router();

// FunÃ§Ã£o para traduzir status de tickets para portuguÃªs
function translateTicketStatus(status: string): string {
  const translations: Record<string, string> = {
    'new': 'Novo',
    'ongoing': 'Em Andamento', 
    'suspended': 'Suspenso',
    'waiting_customer': 'Aguardando Cliente',
    'escalated': 'Escalado',
    'in_analysis': 'Em AnÃ¡lise',
    'pending_deployment': 'Aguardando Deploy',
    'reopened': 'Reaberto',
    'resolved': 'Resolvido',
    'closed': 'Encerrado',
    // Valores especiais
    'undefined': 'NÃ£o Definido',
    'null': 'NÃ£o Definido',
    '': 'NÃ£o Definido'
  };
  
  return translations[status] || status;
}

// FunÃ§Ã£o utilitÃ¡ria para normalizar prioridade (primeira letra maiÃºscula, resto minÃºsculo)
// IGUAL ao dashboard.tsx para consistÃªncia total
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

// FunÃ§Ã£o para formatar data/hora em portuguÃªs brasileiro
function formatarDataHora(dataInput: string | Date): string {
  if (!dataInput) return '';
  
  try {
    let data: Date;
    
    // Converter para Date baseado no tipo de entrada
    if (typeof dataInput === 'string') {
      data = new Date(dataInput);
    } else {
      data = dataInput;
    }
    
    // Verificar se a data Ã© vÃ¡lida
    if (isNaN(data.getTime())) {
      console.warn('Data invÃ¡lida:', dataInput);
      return '';
    }
    
    // FormataÃ§Ã£o ULTRA simples - sem complicaÃ§Ãµes
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    const hora = data.getHours().toString().padStart(2, '0');
    const minuto = data.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    
  } catch (e) {
    console.error('Erro ao formatar data:', e, 'Input:', dataInput);
    return String(dataInput); // Fallback para string original
  }
}

// Function to generate HTML content for PDF export
function generatePDFHTML(headers: string[], rows: any[][], reportTitle: string = 'RelatÃ³rio de Chamados'): string {
  // Format data for better PDF display with proper translations
  const tableRows = rows.map(row => {
    const formattedRow = row.map((cell, index) => {
      let value = String(cell || '').replace(/"/g, '');
      const header = headers[index];
      
      // Apply specific formatting based on column type
      if (header === 'Status') {
        value = translateTicketStatus(value);
      } else if (header === 'Prioridade') {
        value = normalizarPrioridade(value);
      } else if (header === 'AtribuÃ­do a') {
        if (value === 'N/A' || value === '' || !value) {
          value = 'NÃ£o AtribuÃ­do';
        }
      } else if (header === 'Criado em' || header === 'Resolvido em') {
        // As datas jÃ¡ vÃªm formatadas do backend, nÃ£o precisa formatar novamente
        if (header === 'Resolvido em' && (value === 'N/A' || value === '' || !value)) {
          value = 'NÃ£o resolvido';
        }
      }
      
      // Set CSS classes for styling
      let cssClass = '';
      if (header === 'Criado em' || header === 'Resolvido em') {
        cssClass = 'date';
      } else if (header === 'Status') {
        cssClass = 'status';
      } else if (header === 'Prioridade') {
        cssClass = 'priority';
      }
      
      return `<td class="${cssClass}">${value}</td>`;
    }).join('');
    
    return `<tr>${formattedRow}</tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle}</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
          font-size: 10px;
          margin: 0;
          padding: 15px;
          line-height: 1.4;
        }
        h1 { 
          color: #2563eb; 
          text-align: center;
          font-size: 20px;
          margin-bottom: 25px;
          font-weight: 600;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 7px;
          margin-bottom: 15px;
        }
        th, td { 
          border: 1px solid #e5e7eb; 
          padding: 6px 4px; 
          text-align: left;
          word-wrap: break-word;
          vertical-align: top;
        }
        th { 
          background-color: #f8fafc; 
          font-weight: 600;
          font-size: 8px;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          white-space: nowrap;
          text-align: center;
        }
        tr:nth-child(even) { 
          background-color: #fafafa; 
        }
        tr:hover {
          background-color: #f3f4f6;
        }
        .date { 
          white-space: nowrap; 
          font-family: 'Courier New', monospace;
          font-size: 6px;
          text-align: center;
        }
        .status {
          text-align: center;
          font-weight: 600;
          font-size: 7px;
          padding: 2px 4px;
          border-radius: 3px;
        }
        .priority {
          text-align: center;
          font-weight: 600;
          font-size: 7px;
        }
        .footer {
          margin-top: 20px; 
          text-align: center; 
          font-size: 7px; 
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        @media print {
          body { font-size: 8px; }
          table { font-size: 6px; }
          th { font-size: 7px; }
        }
      </style>
    </head>
    <body>
      <h1>ðŸ“‹ ${reportTitle}</h1>
      <table>
        <thead>
          <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        <strong>RelatÃ³rio gerado em:</strong> ${new Date().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })} | <strong>Total de registros:</strong> ${rows.length}
      </div>
    </body>
    </html>
  `;
}

// Basic health check for reports API
router.get('/health', (req, res) => {
  res.json({ status: 'Reports API is running', timestamp: new Date().toISOString() });
});

// Ticket reports - SIMPLE WORKING VERSION
router.get('/tickets', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, status, priority, departmentId, companyId: _companyId, incidentTypeId, incident_type_id } = req.query;
    
    // Usar start_date e end_date se disponÃ­veis (compatibilidade com dashboard)
    const startDateParam = start_date || startDate;
    const endDateParam = end_date || endDate;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    
    console.log('Reports - Query params:', { startDateParam, endDateParam, status, priority, departmentId, incidentTypeParam });
    
    // Build base query - versÃ£o simples sem joins complexos
    let baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      title: schema.tickets.title,
      description: schema.tickets.description,
      status: schema.tickets.status,
      type: schema.tickets.type,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      updated_at: schema.tickets.updated_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      closed_at: schema.tickets.resolved_at, // Usando resolved_at como closed_at para compatibilidade
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      customer_id: schema.tickets.customer_id,
      customer_email: schema.tickets.customer_email,
      assigned_to_id: schema.tickets.assigned_to_id,
      company_id: schema.tickets.company_id,
      category_id: schema.tickets.category_id,
      incident_type_id: schema.tickets.incident_type_id
    })
    .from(schema.tickets);

    // Apply role-based filters - IGUAL Ã€ TELA DE TICKETS
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;
    
    console.log('Reports - User info:', { userId, userRole });
    
    if (!userId || !userRole) {
      return res.status(401).json({ message: "UsuÃ¡rio nÃ£o autenticado" });
    }
    
    const roleConditions: any[] = [];
    
    if (userRole === 'admin') {
      // Admin vÃª tudo - sem filtros
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: "UsuÃ¡rio sem empresa definida" });
      }
      console.log('Reports - Company Admin - Company ID:', user.company_id);
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do manager
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Manager sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do manager
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Manager vÃª: tickets dos seus departamentos E (atribuÃ­dos a ele OU subordinados OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do supervisor
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Supervisor sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do supervisor
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Supervisor vÃª: tickets dos seus departamentos E (atribuÃ­dos a ele OU subordinados OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do support
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Support sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Support vÃª apenas: tickets dos seus departamentos E (atribuÃ­dos a ele OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: "Customer nÃ£o encontrado" });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: "Role nÃ£o reconhecido" });
    }
    
    // Apply additional filters (datas, status, priority, department)
    const additionalFilters = [];

    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam as string)));
    }

    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam as string)));
    }

    if (status && status !== 'all') {
      // Aceitar mÃºltiplos status separados por vÃ­rgula
      const statusArray = typeof status === 'string' ? status.split(',').filter(s => s.trim() !== '') : [];
      if (statusArray.length > 0) {
        if (statusArray.length === 1) {
          additionalFilters.push(eq(schema.tickets.status, statusArray[0] as any));
        } else {
          additionalFilters.push(inArray(schema.tickets.status, statusArray as any[]));
        }
      }
    }

    if (priority && priority !== 'all') {
      additionalFilters.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }

    // Combinar TODAS as condiÃ§Ãµes (role + filtros) em uma Ãºnica clÃ¡usula WHERE
    const allConditions = [...roleConditions, ...additionalFilters];
    
    console.log('Reports - Role conditions count:', roleConditions.length);
    console.log('Reports - Additional filters count:', additionalFilters.length);
    console.log('Reports - Total conditions count:', allConditions.length);
    
    if (allConditions.length > 0) {
      baseQuery = baseQuery.where(and(...allConditions)) as any;
    }

    // Execute query
    const tickets = await baseQuery.orderBy(desc(schema.tickets.created_at));
    
    console.log('Reports - Tickets found:', tickets.length);
    console.log('Reports - Sample ticket dates:', tickets.slice(0, 3).map(t => t.created_at));

    // Get additional data for joined fields - filtrando valores null
    const departmentIds = Array.from(new Set(tickets.map(t => t.department_id).filter(id => id !== null))) as number[];
    const customerIds = Array.from(new Set(tickets.map(t => t.customer_id).filter(id => id !== null))) as number[];
    const assignedToIds = Array.from(new Set(tickets.map(t => t.assigned_to_id).filter(id => id !== null))) as number[];

    // Fetch departments
    const departments = departmentIds.length > 0 
      ? await db.select({ id: schema.departments.id, name: schema.departments.name })
          .from(schema.departments)
          .where(inArray(schema.departments.id, departmentIds))
      : [];

    // Fetch customers
    const customers = customerIds.length > 0
      ? await db.select({ id: schema.customers.id, name: schema.customers.name, email: schema.customers.email })
          .from(schema.customers)
          .where(inArray(schema.customers.id, customerIds))
      : [];

    // Fetch officials (NÃƒO users - assigned_to_id aponta para officials.id!)
    const officials = assignedToIds.length > 0
      ? await db.select({ id: schema.officials.id, name: schema.officials.name, email: schema.officials.email })
          .from(schema.officials)
          .where(inArray(schema.officials.id, assignedToIds))
      : [];

    // Fetch department priorities for all departments
    const departmentPriorities = await db.select({
      id: schema.departmentPriorities.id,
      name: schema.departmentPriorities.name,
      weight: schema.departmentPriorities.weight,
      color: schema.departmentPriorities.color,
      department_id: schema.departmentPriorities.department_id,
      company_id: schema.departmentPriorities.company_id
    })
    .from(schema.departmentPriorities)
    .where(and(
      inArray(schema.departmentPriorities.department_id, departmentIds),
      eq(schema.departmentPriorities.is_active, true)
    ));

    // Create lookup maps
    const departmentMap = new Map(departments.map(d => [d.id, d]));
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const officialMap = new Map(officials.map(o => [o.id, o]));
    
    // Create priority lookup map
    const priorityMap = new Map();
    departmentPriorities.forEach(p => {
      const key = `${p.department_id}-${p.name.toLowerCase()}`;
      priorityMap.set(key, p);
    });

    // Process results with joined data - formato correto para o componente React
    const processedTickets = tickets.map(ticket => {
      // Buscar informaÃ§Ãµes da prioridade do departamento
      let priorityInfo = null;
      if (ticket.department_id && ticket.priority) {
        const key = `${ticket.department_id}-${ticket.priority.toLowerCase()}`;
        priorityInfo = priorityMap.get(key);
      }

      return {
        id: ticket.id,
        ticket_id: ticket.ticket_id,
        title: ticket.title || '',
        description: ticket.description || '',
        status: ticket.status,
        priority: ticket.priority,
        priority_weight: priorityInfo?.weight,
        priority_color: priorityInfo?.color,
        priority_name: priorityInfo?.name,
        created_at: ticket.created_at.toISOString(),
        updated_at: ticket.updated_at.toISOString(),
        resolved_at: ticket.resolved_at ? ticket.resolved_at.toISOString() : null,
        closed_at: ticket.closed_at ? ticket.closed_at.toISOString() : null,
        department: ticket.department_id ? departmentMap.get(ticket.department_id) || { id: ticket.department_id, name: 'N/A' } : { id: 0, name: 'N/A' },
        customer: ticket.customer_id ? customerMap.get(ticket.customer_id) || { id: ticket.customer_id, name: 'N/A', email: ticket.customer_email } : { id: 0, name: 'N/A', email: ticket.customer_email },
        assigned_to: ticket.assigned_to_id ? officialMap.get(ticket.assigned_to_id) || null : null
      };
    });

    // Calculate statistics based on actual status values
    const totalTickets = processedTickets.length;
    const openTickets = processedTickets.filter(t => ['new', 'open'].includes(t.status)).length;
    const inProgressTickets = processedTickets.filter(t => ['in_progress', 'ongoing'].includes(t.status)).length;
    const resolvedTickets = processedTickets.filter(t => t.status === 'resolved').length;
    const closedTickets = processedTickets.filter(t => t.status === 'closed').length;

    res.json({
      tickets: processedTickets,
      stats: {
        total: totalTickets,
        open: openTickets,
        in_progress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatÃ³rio de tickets:', error);
    res.status(500).json({ message: 'Erro ao gerar relatÃ³rio de tickets' });
  }
});

// Export tickets to multiple formats
router.get('/tickets/export', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, status, priority, departmentId, companyId: _companyId, incidentTypeId, incident_type_id, format = 'csv' } = req.query;
    
    // Usar start_date e end_date se disponÃ­veis (compatibilidade com dashboard)
    const startDateParam = start_date || startDate;
    const endDateParam = end_date || endDate;
    const _incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    
    // Build base query - versÃ£o simples sem joins complexos
    let baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      title: schema.tickets.title,
      description: schema.tickets.description,
      status: schema.tickets.status,
      type: schema.tickets.type,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      updated_at: schema.tickets.updated_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      customer_id: schema.tickets.customer_id,
      customer_email: schema.tickets.customer_email,
      assigned_to_id: schema.tickets.assigned_to_id,
      company_id: schema.tickets.company_id
    })
    .from(schema.tickets);

    // Apply role-based filters - IGUAL Ã€ TELA DE TICKETS
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;
    
    console.log('Reports - User info:', { userId, userRole });
    
    if (!userId || !userRole) {
      return res.status(401).json({ message: "UsuÃ¡rio nÃ£o autenticado" });
    }
    
    const roleConditions: any[] = [];
    
    if (userRole === 'admin') {
      // Admin vÃª tudo - sem filtros
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: "UsuÃ¡rio sem empresa definida" });
      }
      console.log('Reports - Company Admin - Company ID:', user.company_id);
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do manager
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Manager sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do manager
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Manager vÃª: tickets dos seus departamentos E (atribuÃ­dos a ele OU subordinados OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do supervisor
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Supervisor sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do supervisor
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Supervisor vÃª: tickets dos seus departamentos E (atribuÃ­dos a ele OU subordinados OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official nÃ£o encontrado" });
      }
      
      // Buscar departamentos do support
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Support sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Support vÃª apenas: tickets dos seus departamentos E (atribuÃ­dos a ele OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: "Customer nÃ£o encontrado" });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: "Role nÃ£o reconhecido" });
    }
    
    // Apply additional filters (datas, status, priority, department)
    const additionalFilters = [];

    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam as string)));
    }

    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam as string)));
    }

    if (status && status !== 'all') {
      // Aceitar mÃºltiplos status separados por vÃ­rgula
      const statusArray = typeof status === 'string' ? status.split(',').filter(s => s.trim() !== '') : [];
      if (statusArray.length > 0) {
        if (statusArray.length === 1) {
          additionalFilters.push(eq(schema.tickets.status, statusArray[0] as any));
        } else {
          additionalFilters.push(inArray(schema.tickets.status, statusArray as any[]));
        }
      }
    }

    if (priority && priority !== 'all') {
      additionalFilters.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    // Combinar TODAS as condiÃ§Ãµes (role + filtros) em uma Ãºnica clÃ¡usula WHERE
    const allConditions = [...roleConditions, ...additionalFilters];
    
    console.log('Reports - Role conditions count:', roleConditions.length);
    console.log('Reports - Additional filters count:', additionalFilters.length);
    console.log('Reports - Total conditions count:', allConditions.length);
    
    if (allConditions.length > 0) {
      baseQuery = baseQuery.where(and(...allConditions)) as any;
    }

    // Execute query
    const tickets = await baseQuery.orderBy(desc(schema.tickets.created_at));

    // Get additional data for joined fields - filtrando valores null
    const departmentIds = Array.from(new Set(tickets.map(t => t.department_id).filter(id => id !== null))) as number[];
    const customerIds = Array.from(new Set(tickets.map(t => t.customer_id).filter(id => id !== null))) as number[];
    const assignedToIds = Array.from(new Set(tickets.map(t => t.assigned_to_id).filter(id => id !== null))) as number[];

    // Fetch departments
    const departments = departmentIds.length > 0 
      ? await db.select({ id: schema.departments.id, name: schema.departments.name })
          .from(schema.departments)
          .where(inArray(schema.departments.id, departmentIds))
      : [];

    // Fetch customers
    const customers = customerIds.length > 0
      ? await db.select({ id: schema.customers.id, name: schema.customers.name })
          .from(schema.customers)
          .where(inArray(schema.customers.id, customerIds))
      : [];

    // Fetch officials (NÃƒO users - assigned_to_id aponta para officials.id!)
    const officials = assignedToIds.length > 0
      ? await db.select({ id: schema.officials.id, name: schema.officials.name, email: schema.officials.email })
          .from(schema.officials)
          .where(inArray(schema.officials.id, assignedToIds))
      : [];

    // Fetch department priorities for all departments
    const departmentPriorities = await db.select({
      id: schema.departmentPriorities.id,
      name: schema.departmentPriorities.name,
      weight: schema.departmentPriorities.weight,
      color: schema.departmentPriorities.color,
      department_id: schema.departmentPriorities.department_id,
      company_id: schema.departmentPriorities.company_id
    })
    .from(schema.departmentPriorities)
    .where(and(
      inArray(schema.departmentPriorities.department_id, departmentIds),
      eq(schema.departmentPriorities.is_active, true)
    ));

    // Create lookup maps
    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    const officialMap = new Map(officials.map(o => [o.id, { name: o.name, email: o.email }]));
    
    // Create priority lookup map
    const priorityMap = new Map();
    departmentPriorities.forEach(p => {
      const key = `${p.department_id}-${p.name.toLowerCase()}`;
      priorityMap.set(key, p);
    });

    // Process results with joined data
    const processedTickets = tickets.map(ticket => {
      // Buscar informaÃ§Ãµes da prioridade do departamento
      let priorityInfo = null;
      if (ticket.department_id && ticket.priority) {
        const key = `${ticket.department_id}-${ticket.priority.toLowerCase()}`;
        priorityInfo = priorityMap.get(key);
      }

      return {
        ...ticket,
        title: ticket.title || '',
        description: ticket.description || '',
        department_name: ticket.department_id ? departmentMap.get(ticket.department_id) || 'N/A' : 'N/A',
        customer_name: ticket.customer_id ? customerMap.get(ticket.customer_id) || 'N/A' : 'N/A',
        customer_email: ticket.customer_email || '',
              assigned_to_name: ticket.assigned_to_id ? officialMap.get(ticket.assigned_to_id)?.name || 'N/A' : 'NÃ£o atribuÃ­do',
      assigned_to_email: ticket.assigned_to_id ? officialMap.get(ticket.assigned_to_id)?.email || '' : '',
        priority_weight: priorityInfo?.weight,
        priority_color: priorityInfo?.color,
        priority_name: priorityInfo?.name
      };
    });

    // Generate data for export - ONLY fields shown on screen
    const exportHeaders = [
      'Ticket ID', 
      'TÃ­tulo', 
      'Cliente', 
      'Departamento', 
      'AtribuÃ­do a', 
      'Status', 
      'Prioridade', 
      'Criado em', 
      'Resolvido em'
    ];

    const exportRows = processedTickets.map(ticket => [
      ticket.ticket_id,
      `"${ticket.title.replace(/"/g, '""')}"`,
      `"${ticket.customer_name.replace(/"/g, '""')}"`,
      ticket.department_name,
      ticket.assigned_to_name === 'N/A' || !ticket.assigned_to_name ? 'NÃ£o AtribuÃ­do' : `"${ticket.assigned_to_name.replace(/"/g, '""')}"`,
      translateTicketStatus(ticket.status),
      ticket.priority_name || normalizarPrioridade(ticket.priority),
      formatarDataHora(ticket.created_at),
      ticket.resolved_at ? formatarDataHora(ticket.resolved_at) : 'NÃ£o resolvido'
    ]);

    // Generate output based on format
    const exportFormat = (format as string).toLowerCase();
    
    if (exportFormat === 'excel') {
      // Excel export with proper formatting - ONLY screen fields
      const workbook = XLSX.utils.book_new();
      
      // Prepare data with proper types for Excel - ONLY screen fields
      const excelData = processedTickets.map(ticket => ({
        'Ticket ID': ticket.ticket_id,
        'TÃ­tulo': ticket.title,
        'Cliente': ticket.customer_name,
        'Departamento': ticket.department_name,
        'AtribuÃ­do a': ticket.assigned_to_name === 'N/A' || !ticket.assigned_to_name ? 'NÃ£o AtribuÃ­do' : ticket.assigned_to_name,
        'Status': translateTicketStatus(ticket.status),
        'Prioridade': ticket.priority_name || normalizarPrioridade(ticket.priority),
        'Criado em': formatarDataHora(ticket.created_at),
        'Resolvido em': ticket.resolved_at ? formatarDataHora(ticket.resolved_at) : 'NÃ£o resolvido'
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths - ONLY screen fields
      const colWidths = [
        { wch: 15 },  // Ticket ID
        { wch: 35 },  // TÃ­tulo
        { wch: 25 },  // Cliente
        { wch: 20 },  // Departamento
        { wch: 25 },  // AtribuÃ­do a
        { wch: 12 },  // Status
        { wch: 12 },  // Prioridade
        { wch: 18 },  // Criado em
        { wch: 18 }   // Resolvido em
      ];
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatÃ³rio de Chamados');
      
      // ProteÃ§Ã£o contra vulnerabilidades xlsx (CVE GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
      // Adiciona timeout para prevenir DoS via arquivos complexos
      logger.info('Gerando arquivo Excel de tickets', { 
        recordCount: excelData.length,
        user: req.user?.username 
      });
      
      const buffer = await withTimeout(
        Promise.resolve(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })),
        30000, // 30 segundos timeout
        'Timeout ao gerar arquivo Excel. O arquivo pode ser muito grande.'
      );
      
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-chamados.xlsx');
      return res.end(buffer);
      
    } else if (exportFormat === 'pdf') {
      // PDF export with proper binary handling
      console.log('Starting PDF generation...');
      const htmlContent = generatePDFHTML(exportHeaders, exportRows);
      console.log('HTML content generated, length:', htmlContent.length);
      
      let browser;
      try {
        console.log('Launching Puppeteer...');
        browser = await puppeteer.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Puppeteer launched successfully');
        
        const page = await browser.newPage();
        console.log('New page created');
        
        await page.setContent(htmlContent);
        console.log('HTML content set');
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          }
        });
        console.log('PDF generated, buffer size:', pdfBuffer.length);
        
        await browser.close();
        console.log('Browser closed');
        
        res.type('application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-chamados.pdf');
        return res.end(pdfBuffer);
        
      } catch (pdfError: any) {
        console.error('PDF generation error details:', {
          message: pdfError?.message || 'Unknown error',
          stack: pdfError?.stack,
          name: pdfError?.name
        });
        
        if (browser) {
          try {
            await browser.close();
            console.log('Browser closed after error');
          } catch (closeError) {
            console.error('Error closing browser:', closeError);
          }
        }
        

        
        return res.status(500).json({ 
          error: 'Erro ao gerar PDF', 
          details: pdfError?.message || 'Erro desconhecido na geraÃ§Ã£o do PDF'
        });
      }
      
    } else {
      // Formato nÃ£o suportado
      return res.status(400).json({ 
        error: 'Formato nÃ£o suportado. Use: excel ou pdf' 
      });
    }

  } catch (error) {
    console.error('Error exporting tickets report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Performance reports
router.get('/performance', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, companyId, showInactiveOfficials, incidentTypeId, incident_type_id } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    const _showInactiveOfficialsParam = showInactiveOfficials === 'true';

    // Build base query for tickets
    const _baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      assigned_to_id: schema.tickets.assigned_to_id,
      company_id: schema.tickets.company_id
    }).from(schema.tickets);

    // Role-based filters (same logic as /tickets)
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'UsuÃ¡rio nÃ£o autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Manager sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Supervisor sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Support sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer nÃ£o encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role nÃ£o reconhecido' });
    }

    const additionalFilters: any[] = [];
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    if (departmentId) {
      additionalFilters.push(eq(schema.tickets.department_id, Number(departmentId)));
    }
    if (companyId) {
      additionalFilters.push(eq(schema.tickets.company_id, Number(companyId)));
    }
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }

    // Build where clause safely
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      const validRoleConditions = roleConditions.filter(condition => condition !== undefined && condition !== null);
      if (validRoleConditions.length > 0) {
        allConditions.push(and(...validRoleConditions));
      }
    }
    
    if (additionalFilters.length > 0) {
      const validAdditionalFilters = additionalFilters.filter(filter => filter !== undefined && filter !== null);
      if (validAdditionalFilters.length > 0) {
        allConditions.push(and(...validAdditionalFilters));
      }
    }
    
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    // Validate schema objects before using them
    if (!schema || !schema.tickets) {
      throw new Error('Schema de tickets nÃ£o encontrado');
    }

    // Define the select fields object with validation
    const selectFields = Object.fromEntries(
      Object.entries({
        id: schema.tickets.id,
        assigned_to_id: schema.tickets.assigned_to_id,
        department_id: schema.tickets.department_id,
        created_at: schema.tickets.created_at,
        first_response_at: schema.tickets.first_response_at,
        resolved_at: schema.tickets.resolved_at
      }).filter(([_key, value]) => value !== undefined && value !== null)
    );

    // Validate that we have valid select fields
    if (!selectFields || Object.keys(selectFields).length === 0) {
      throw new Error('Campos de seleÃ§Ã£o invÃ¡lidos para tickets');
    }

    // Build the base query with validation
    let ticketsQuery = db.select(selectFields).from(schema.tickets);
    
    // Apply where clause if it exists
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause as any) as any;
    }
    
    const tickets = await ticketsQuery;

    // Collect IDs first
    const ticketIds = tickets.map(t => t.id);

    // Fetch status history for all tickets to calculate effective business time
    let statusHistories: any[] = [];
    if (ticketIds.length > 0) {
      // Validate schema before using it
      if (!schema.ticketStatusHistory) {
        throw new Error('Schema de histÃ³rico de status nÃ£o encontrado');
      }

      const statusHistorySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.ticketStatusHistory.ticket_id,
          created_at: schema.ticketStatusHistory.created_at
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(statusHistorySelectFields).length === 0) {
        throw new Error('Campos de seleÃ§Ã£o invÃ¡lidos para histÃ³rico de status');
      }
      
      statusHistories = await db.select(statusHistorySelectFields)
        .from(schema.ticketStatusHistory)
        .where(inArray(schema.ticketStatusHistory.ticket_id, ticketIds.filter(id => typeof id === 'number')))
        .orderBy(schema.ticketStatusHistory.created_at);
    }

    // Group status history by ticket
    const statusHistoryByTicket = new Map<number, Array<{ status: TicketStatus; created_at: Date }>>();
    statusHistories.forEach(sh => {
      const arr = statusHistoryByTicket.get(sh.ticket_id) || [];
      arr.push({ status: sh.status as TicketStatus, created_at: sh.created_at });
      statusHistoryByTicket.set(sh.ticket_id, arr);
    });

    // Get business hours configuration
    const _businessHours = getBusinessHoursConfig();
    const deptIds = Array.from(new Set(tickets.map(t => t.department_id).filter(Boolean))) as number[];
    const officialIds = Array.from(new Set(tickets.map(t => t.assigned_to_id).filter(Boolean))) as number[];

    // Fetch lookup data
    let departments: any[] = [];
    if (deptIds.length > 0) {
      // Validate schema before using it
      if (!schema.departments) {
        throw new Error('Schema de departamentos nÃ£o encontrado');
      }

      const departmentSelectFields = Object.fromEntries(
        Object.entries({
          id: schema.departments.id,
          name: schema.departments.name
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(departmentSelectFields).length === 0) {
        throw new Error('Campos de seleÃ§Ã£o invÃ¡lidos para departamentos');
      }
      
      departments = await db.select(departmentSelectFields)
        .from(schema.departments)
        .where(inArray(schema.departments.id, deptIds));
    }

    let officials: any[] = [];
    if (officialIds.length > 0) {
      // Validate schema before using it
      if (!schema.officials) {
        throw new Error('Schema de funcionÃ¡rios nÃ£o encontrado');
      }

      const officialSelectFields = Object.fromEntries(
        Object.entries({
          id: schema.officials.id,
          name: schema.officials.name,
          email: schema.officials.email
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(officialSelectFields).length === 0) {
        throw new Error('Campos de seleÃ§Ã£o invÃ¡lidos para funcionÃ¡rios');
      }
      
      officials = await db.select(officialSelectFields)
        .from(schema.officials)
        .where(inArray(schema.officials.id, officialIds));
    }

    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      // Validate schema before using it
      if (!schema.satisfactionSurveys) {
        throw new Error('Schema de pesquisas de satisfaÃ§Ã£o nÃ£o encontrado');
      }

      const surveySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.satisfactionSurveys.ticket_id,
          rating: schema.satisfactionSurveys.rating,
          responded_at: schema.satisfactionSurveys.responded_at
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(surveySelectFields).length === 0) {
        throw new Error('Campos de seleÃ§Ã£o invÃ¡lidos para pesquisas de satisfaÃ§Ã£o');
      }
      
      surveys = await db.select(surveySelectFields)
        .from(schema.satisfactionSurveys)
        .where(inArray(schema.satisfactionSurveys.ticket_id, ticketIds.filter(id => typeof id === 'number')));
    }

    // As funÃ§Ãµes helper foram removidas - agora usamos as funÃ§Ãµes do storage que sÃ£o as mesmas do dashboard

    // Group by official
    const officialMap = new Map(officials.map(o => [o.id, { name: o.name, email: o.email }]));
    const ticketsByOfficial = new Map<number, typeof tickets>();
    tickets.forEach(t => {
      if (!t.assigned_to_id || typeof t.assigned_to_id !== 'number') return;
      const arr = ticketsByOfficial.get(t.assigned_to_id) || [];
      (arr as any).push(t);
      ticketsByOfficial.set(t.assigned_to_id, arr as any);
    });

    const surveysByTicket = new Map<number, { rating: number | null; responded_at: Date | null }[]>();
    surveys.forEach(s => {
      if (typeof s.ticket_id !== 'number') return;
      const arr = surveysByTicket.get(s.ticket_id) || [];
      arr.push({ rating: s.rating, responded_at: s.responded_at });
      surveysByTicket.set(s.ticket_id, arr);
    });

    // Calcular mÃ©tricas por atendente usando as mesmas funÃ§Ãµes do dashboard
    const officialsMetrics = await Promise.all(
      Array.from(ticketsByOfficial.entries()).map(async ([officialId, ts]) => {
        if (typeof officialId !== 'number') return null;
        const ticketsAssigned = ts.length;
        const resolvedTickets = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funÃ§Ãµes do dashboard para garantir consistÃªncia
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          officialId as number, // officialId especÃ­fico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentId ? Number(departmentId) : undefined
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          officialId as number, // officialId especÃ­fico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentId ? Number(departmentId) : undefined
        );

        // Satisfaction average for this official (tickets currently assigned to the official)
        const ratings: number[] = [];
        ts.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          official_id: officialId as number,
          name: officialMap.get(officialId as number)?.name || 'N/A',
          email: officialMap.get(officialId as number)?.email || '',
          tickets_assigned: ticketsAssigned,
          tickets_resolved: resolvedTickets,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );
    
    // Ordenar por tickets resolvidos
    officialsMetrics.filter(m => m !== null).sort((a, b) => (b!.tickets_resolved - a!.tickets_resolved));

    // Group by department
    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    const ticketsByDept = new Map<number, typeof tickets>();
    tickets.forEach(t => {
      if (!t.department_id || typeof t.department_id !== 'number') return;
      const arr = ticketsByDept.get(t.department_id) || [];
      (arr as any).push(t);
      ticketsByDept.set(t.department_id, arr as any);
    });

    // Calcular mÃ©tricas por departamento usando as mesmas funÃ§Ãµes do dashboard
    const departmentsMetrics = await Promise.all(
      Array.from(ticketsByDept.entries()).map(async ([deptId, ts]) => {
        if (typeof deptId !== 'number') return null;
        const total = ts.length;
        const resolved = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funÃ§Ãµes do dashboard para garantir consistÃªncia
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId as number // departmentId especÃ­fico
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId as number // departmentId especÃ­fico
        );

        // Satisfaction average for this department
        const ratings: number[] = [];
        ts.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          department_id: deptId as number,
          department_name: departmentMap.get(deptId as number) || 'N/A',
          tickets: total,
          resolved_tickets: resolved,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );
    
    // Ordenar por tickets resolvidos
    departmentsMetrics.filter(m => m !== null).sort((a, b) => (b!.resolved_tickets - a!.resolved_tickets));

    // Summary - USAR AS MESMAS FUNÃ‡Ã•ES DO DASHBOARD
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.resolved_at !== null).length;
    
    // Usar as mesmas funÃ§Ãµes do dashboard para garantir consistÃªncia
    const avgFirstResponseTimeHours = await storage.getAverageFirstResponseTimeByUserRole(
      userId, 
      userRole, 
      undefined, // officialId - usar undefined para todos os atendentes no resumo
      startDateParam ? new Date(startDateParam) : undefined,
      endDateParam ? new Date(endDateParam) : undefined,
      departmentId ? Number(departmentId) : undefined
    );
    
    const avgResolutionTimeHours = await storage.getAverageResolutionTimeByUserRole(
      userId, 
      userRole, 
      undefined, // officialId - usar undefined para todos os atendentes no resumo
      startDateParam ? new Date(startDateParam) : undefined,
      endDateParam ? new Date(endDateParam) : undefined,
      departmentId ? Number(departmentId) : undefined
    );
    
    const summary = {
      total_tickets: totalTickets,
      resolved_tickets: resolvedTickets,
      avg_first_response_time_hours: avgFirstResponseTimeHours || null,
      avg_resolution_time_hours: avgResolutionTimeHours || null,
      satisfaction_avg: (() => {
        const ratings: number[] = [];
        tickets.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        return ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;
      })()
    };

    return res.json({
      summary,
      officials: officialsMetrics.filter(m => m !== null),
      departments: departmentsMetrics.filter(m => m !== null)
    });
  } catch (error) {
    console.error('Erro ao gerar relatÃ³rio de performance:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatÃ³rio de performance' });
  }
});

// Export performance report to multiple formats
router.get('/performance/export', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, companyId, showInactiveOfficials, incidentTypeId: _incidentTypeId, incident_type_id: _incident_type_id, format = 'csv' } = req.query;
    
    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const departmentIdParam = departmentId as string | undefined;
    const companyIdParam = companyId as string | undefined;
    const showInactiveOfficialsParam = showInactiveOfficials === 'true';

    // Build base query for tickets - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      assigned_to_id: schema.tickets.assigned_to_id,
      company_id: schema.tickets.company_id
    }).from(schema.tickets);

    // Role-based filters - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'UsuÃ¡rio nÃ£o autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Manager sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do manager
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Manager vÃª: tickets dos seus departamentos E (atribuÃ­dos a ele OU subordinados OU nÃ£o atribuÃ­dos)
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Supervisor sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Buscar subordinados do supervisor
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      
      roleConditions.push(
        and(
          inArray(schema.tickets.department_id, departmentIds),
          assignmentFilter
        )
      );
      
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Support sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer nÃ£o encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role nÃ£o reconhecido' });
    }

    // Apply additional filters - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const additionalFilters: any[] = [];
    
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    
    if (departmentIdParam) {
      additionalFilters.push(eq(schema.tickets.department_id, Number(departmentIdParam)));
    }
    
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }
    
    if (companyIdParam) {
      additionalFilters.push(eq(schema.tickets.company_id, Number(companyIdParam)));
    }

    // Build where clause safely - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      allConditions.push(and(...roleConditions));
    }
    
    if (additionalFilters.length > 0) {
      allConditions.push(and(...additionalFilters));
    }

    // Execute query - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const tickets = await baseQuery
      .where(allConditions.length > 0 ? and(...allConditions) : undefined)
      .orderBy(desc(schema.tickets.created_at));

    // Group tickets by assigned user - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const ticketsByOfficial = new Map<number | null, typeof tickets>();
    tickets.forEach(ticket => {
      const officialId = ticket.assigned_to_id;
      if (!ticketsByOfficial.has(officialId)) {
        ticketsByOfficial.set(officialId, []);
      }
      ticketsByOfficial.get(officialId)!.push(ticket);
    });

    // Buscar dados dos atendentes - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const officialIds = Array.from(new Set(tickets.map(t => t.assigned_to_id).filter(Boolean))) as number[];
    
    let officials: any[] = [];
    if (officialIds.length > 0) {
      const officialSelectFields = Object.fromEntries(
        Object.entries({
          id: schema.officials.id,
          name: schema.officials.name,
          email: schema.officials.email
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(officialSelectFields).length > 0) {
        officials = await db.select(officialSelectFields)
          .from(schema.officials)
          .where(inArray(schema.officials.id, officialIds));
      }
    }

    // Buscar dados de satisfaÃ§Ã£o - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const ticketIds = tickets.map(t => t.id);
    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      const surveySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.satisfactionSurveys.ticket_id,
          rating: schema.satisfactionSurveys.rating,
          responded_at: schema.satisfactionSurveys.responded_at
        }).filter(([_key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(surveySelectFields).length > 0) {
        surveys = await db.select(surveySelectFields)
          .from(schema.satisfactionSurveys)
          .where(inArray(schema.satisfactionSurveys.ticket_id, ticketIds));
      }
    }

    // Mapear dados - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const officialMap = new Map(officials.map(o => [o.id, { name: o.name, email: o.email }]));
    const surveysByTicket = new Map<number, { rating: number | null; responded_at: Date | null }[]>();
    surveys.forEach(s => {
      if (typeof s.ticket_id !== 'number') return;
      const arr = surveysByTicket.get(s.ticket_id) || [];
      arr.push({ rating: s.rating, responded_at: s.responded_at });
      surveysByTicket.set(s.ticket_id, arr);
    });

    // Calcular mÃ©tricas por atendente usando as mesmas funÃ§Ãµes do dashboard - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const officialsMetrics = await Promise.all(
      Array.from(ticketsByOfficial.entries()).map(async ([officialId, ts]) => {
        const ticketsAssigned = ts.length;
        const resolvedTickets = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funÃ§Ãµes do dashboard para garantir consistÃªncia
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          officialId as number, // officialId especÃ­fico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentIdParam ? Number(departmentIdParam) : undefined
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          officialId as number, // officialId especÃ­fico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentIdParam ? Number(departmentIdParam) : undefined
        );

        // Satisfaction average for this official (tickets currently assigned to the official)
        const ratings: number[] = [];
        ts.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          official_id: officialId,
          official_name: officialId ? (officialMap.get(officialId)?.name || 'Atendente') : 'NÃ£o atribuÃ­do',
          official_active: true, // Simplificado para export
          tickets_assigned: ticketsAssigned,
          resolved_tickets: resolvedTickets,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );

    // Filter out inactive officials if needed - APÃ“S O CÃLCULO
    let filteredOfficialsMetrics = officialsMetrics;
    if (!showInactiveOfficialsParam) {
      filteredOfficialsMetrics = officialsMetrics.filter(official => 
        official.official_active === true
      );
    }

    // Generate data for export
    const exportHeaders = [
      'Atendente',
      'Status',
      'Tickets AtribuÃ­dos',
      'Tickets Resolvidos',
      'Tempo MÃ©dio 1Âª Resposta (h)',
      'Tempo MÃ©dio ResoluÃ§Ã£o (h)',
      'SatisfaÃ§Ã£o MÃ©dia'
    ];

    // FunÃ§Ã£o para formatar tempo igual ao dashboard (TimeMetricCard)
    const formatTime = (hours: number): string => {
      if (hours === 0) return '0h';
      
      if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes}min`;
      }
      
      if (hours < 24) {
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        return minutes > 0 ? `${wholeHours}h ${minutes}min` : `${wholeHours}h`;
      }
      
      return `${Math.round(hours)}h`;
    };

    const exportRows = filteredOfficialsMetrics.map(official => [
      official.official_name,
      official.official_active === true ? 'Ativo' : 'Inativo',
      official.tickets_assigned,
      official.resolved_tickets,
      official.avg_first_response_time_hours ? formatTime(official.avg_first_response_time_hours) : '-',
      official.avg_resolution_time_hours ? formatTime(official.avg_resolution_time_hours) : '-',
      official.satisfaction_avg ? Math.round(official.satisfaction_avg * 10) / 10 : '-'
    ]);

    // Generate output based on format
    const exportFormat = (format as string).toLowerCase();
    
    if (exportFormat === 'excel') {
      // Excel export with proper formatting
      const workbook = XLSX.utils.book_new();
      
      // Prepare data with proper types for Excel
      const excelData = [
        exportHeaders,
        ...exportRows
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // Set column widths
      worksheet['!cols'] = [
        { width: 25 }, // Atendente
        { width: 10 }, // Status
        { width: 15 }, // Tickets AtribuÃ­dos
        { width: 15 }, // Tickets Resolvidos
        { width: 20 }, // Tempo MÃ©dio 1Âª Resposta
        { width: 20 }, // Tempo MÃ©dio ResoluÃ§Ã£o
        { width: 15 }  // SatisfaÃ§Ã£o MÃ©dia
      ];
      
      // Style header row
      const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E0E0E0' } }
        };
      }
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatÃ³rio Performance');
      
      // ProteÃ§Ã£o contra vulnerabilidades xlsx (CVE GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
      // Adiciona timeout para prevenir DoS via arquivos complexos
      logger.info('Gerando arquivo Excel de performance', { 
        recordCount: exportRows.length,
        user: req.user?.username 
      });
      
      const buffer = await withTimeout(
        Promise.resolve(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })),
        30000, // 30 segundos timeout
        'Timeout ao gerar arquivo Excel. O arquivo pode ser muito grande.'
      );
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-performance.xlsx');
      return res.end(buffer);
      
    } else if (exportFormat === 'pdf') {
      // PDF export with proper binary handling
      console.log('Starting PDF generation for performance report...');
      const htmlContent = generatePDFHTML(exportHeaders, exportRows, 'RelatÃ³rio de Performance');
      console.log('HTML content generated, length:', htmlContent.length);
      
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          // ConfiguraÃ§Ã£o para Windows - usar Chrome/Chromium instalado
          executablePath: process.platform === 'win32' 
            ? undefined // Deixa o Puppeteer encontrar automaticamente
            : '/usr/bin/chromium-browser'
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          }
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-performance.pdf');
        return res.end(pdfBuffer);
        
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        throw pdfError;
      } finally {
        if (browser) {
          await browser.close();
        }
      }
      
    } else {
      // Default to CSV
      const csvContent = [
        exportHeaders.join(','),
        ...exportRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-performance.csv');
      return res.end(csvContent);
    }

  } catch (error) {
    console.error('Error exporting performance report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SLA reports
router.get('/sla', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, incidentTypeId, incident_type_id, assigned_to_id, priority } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    const assignedToParam = assigned_to_id as string | undefined;
    const priorityParam = priority as string | undefined;

    // Build base query for tickets
    const _baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      title: schema.tickets.title,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      company_id: schema.tickets.company_id,
      incident_type_id: schema.tickets.incident_type_id
    }).from(schema.tickets);

    // Role-based filters (same logic as /performance)
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'UsuÃ¡rio nÃ£o autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager' || userRole === 'supervisor' || userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      roleConditions.push(inArray(schema.tickets.department_id, departmentIds));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer nÃ£o encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role nÃ£o reconhecido' });
    }

    const additionalFilters: any[] = [];
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    if (departmentId && departmentId !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }
    if (assignedToParam && assignedToParam !== 'all') {
      const assignedToIdNumber = parseInt(assignedToParam, 10);
      if (!Number.isNaN(assignedToIdNumber)) {
        additionalFilters.push(eq(schema.tickets.assigned_to_id, assignedToIdNumber));
      }
    }
    if (priorityParam && priorityParam !== 'all') {
      // Filtro case-insensitive usando LOWER() do SQL
      // Normalizar o valor para comparaÃ§Ã£o case-insensitive e escapar para SQL
      const normalizedPriority = priorityParam.trim().toLowerCase().replace(/'/g, "''");
      additionalFilters.push(
        sql`LOWER(TRIM(${schema.tickets.priority})) = LOWER(${sql.raw(`'${normalizedPriority}'`)})`
      );
    }

    // Build where clause safely
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      const validRoleConditions = roleConditions.filter(condition => condition !== undefined && condition !== null);
      if (validRoleConditions.length > 0) {
        allConditions.push(and(...validRoleConditions));
      }
    }
    
    if (additionalFilters.length > 0) {
      const validAdditionalFilters = additionalFilters.filter(filter => filter !== undefined && filter !== null);
      if (validAdditionalFilters.length > 0) {
        allConditions.push(and(...validAdditionalFilters));
      }
    }
    
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    // Get tickets
    let ticketsQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      title: schema.tickets.title,
      priority: schema.tickets.priority,
      department_id: schema.tickets.department_id,
      incident_type_id: schema.tickets.incident_type_id,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached
    }).from(schema.tickets);
    
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause as any) as any;
    }
    
    const tickets = await ticketsQuery;

    // Get company_id from user or first ticket
    let _companyId: number | undefined;
    if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      _companyId = user?.company_id || undefined;
    } else if (tickets.length > 0 && tickets[0].department_id) {
      const [dept] = await db.select({ company_id: schema.departments.company_id })
        .from(schema.departments)
        .where(eq(schema.departments.id, tickets[0].department_id))
        .limit(1);
      _companyId = dept?.company_id || undefined;
    }

    // Calculate summary
    const totalTickets = tickets.length;
    const breachedTickets = tickets.filter(t => t.sla_breached === true).length;
    const complianceRate = totalTickets > 0 ? ((totalTickets - breachedTickets) / totalTickets) * 100 : 0;

    // Group by priority (case-insensitive)
    const priorityMap = new Map<string, { total: number; breached: number; originalName: string }>();
    tickets.forEach(t => {
      const prioRaw = t.priority || 'N/A';
      // Usar chave normalizada (case-insensitive) para agrupar
      const prioKey = prioRaw.toLowerCase().trim();
      const current = priorityMap.get(prioKey) || { total: 0, breached: 0, originalName: prioRaw };
      current.total++;
      if (t.sla_breached) current.breached++;
      priorityMap.set(prioKey, current);
    });

    const byPriority = Array.from(priorityMap.entries()).map(([_priorityKey, data]) => ({
      priority: normalizarPrioridade(data.originalName),
      total_tickets: data.total,
      breached_tickets: data.breached,
      compliance_rate: data.total > 0 ? ((data.total - data.breached) / data.total) * 100 : 0
    }));

    // Group by department
    const deptIds = Array.from(new Set(tickets.map(t => t.department_id).filter(Boolean))) as number[];
    const departments = deptIds.length > 0
      ? await db.select({ id: schema.departments.id, name: schema.departments.name })
          .from(schema.departments)
          .where(inArray(schema.departments.id, deptIds))
      : [];

    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    const deptMap = new Map<number, { total: number; breached: number }>();
    tickets.forEach(t => {
      if (!t.department_id) return;
      const current = deptMap.get(t.department_id) || { total: 0, breached: 0 };
      current.total++;
      if (t.sla_breached) current.breached++;
      deptMap.set(t.department_id, current);
    });

    const byDepartment = Array.from(deptMap.entries()).map(([deptId, data]) => ({
      department_id: deptId,
      department_name: departmentMap.get(deptId) || 'N/A',
      total_tickets: data.total,
      breached_tickets: data.breached,
      compliance_rate: data.total > 0 ? ((data.total - data.breached) / data.total) * 100 : 0
    }));

    // Get breached tickets list (limited to 100)
    const breachedTicketsList = tickets
      .filter(t => t.sla_breached)
      .slice(0, 100)
      .map(t => ({
        id: t.id,
        ticket_id: t.ticket_id,
        title: t.title,
        priority: normalizarPrioridade(t.priority || 'N/A'),
        department_name: t.department_id ? (departmentMap.get(t.department_id) || 'N/A') : 'N/A',
        created_at: t.created_at,
        resolved_at: t.resolved_at
      }));

    return res.json({
      summary: {
        total_tickets: totalTickets,
        breached_tickets: breachedTickets,
        within_sla: totalTickets - breachedTickets,
        compliance_rate: Math.round(complianceRate * 100) / 100
      },
      by_priority: byPriority,
      by_department: byDepartment,
      breached_tickets: breachedTicketsList
    });
  } catch (error) {
    console.error('Erro ao gerar relatÃ³rio de SLA:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatÃ³rio de SLA' });
  }
});

// Department reports
router.get('/department', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, department_id, incidentTypeId, incident_type_id } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const departmentIdParam = (department_id || departmentId) as string | undefined;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;

    // Build base query for tickets
    const _baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at,
      sla_breached: schema.tickets.sla_breached,
      department_id: schema.tickets.department_id,
      assigned_to_id: schema.tickets.assigned_to_id,
      company_id: schema.tickets.company_id
    }).from(schema.tickets);

    // Role-based filters (same logic as /performance)
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'UsuÃ¡rio nÃ£o autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Manager sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Supervisor sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Support sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer nÃ£o encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role nÃ£o reconhecido' });
    }

    const additionalFilters: any[] = [];
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    if (departmentIdParam && departmentIdParam !== 'all') {
      const departmentIdNumber = parseInt(departmentIdParam, 10);
      if (!Number.isNaN(departmentIdNumber)) {
        additionalFilters.push(eq(schema.tickets.department_id, departmentIdNumber));
      }
    }
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }

    // Build where clause safely
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      const validRoleConditions = roleConditions.filter(condition => condition !== undefined && condition !== null);
      if (validRoleConditions.length > 0) {
        allConditions.push(and(...validRoleConditions));
      }
    }
    
    if (additionalFilters.length > 0) {
      const validAdditionalFilters = additionalFilters.filter(filter => filter !== undefined && filter !== null);
      if (validAdditionalFilters.length > 0) {
        allConditions.push(and(...validAdditionalFilters));
      }
    }
    
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    // Get tickets
    const selectFields = Object.fromEntries(
      Object.entries({
        id: schema.tickets.id,
        department_id: schema.tickets.department_id,
        created_at: schema.tickets.created_at,
        first_response_at: schema.tickets.first_response_at,
        resolved_at: schema.tickets.resolved_at
      }).filter(([_key, value]) => value !== undefined && value !== null)
    );

    let ticketsQuery = db.select(selectFields).from(schema.tickets);
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause as any) as any;
    }
    
    const tickets = await ticketsQuery;

    const ticketIds = tickets.map(t => t.id);
    const deptIds = Array.from(new Set(tickets.map(t => t.department_id).filter(Boolean))) as number[];

    // Fetch departments
    let departments: any[] = [];
    if (deptIds.length > 0) {
      departments = await db.select({
        id: schema.departments.id,
        name: schema.departments.name
      })
        .from(schema.departments)
        .where(inArray(schema.departments.id, deptIds));
    }

    // Fetch satisfaction surveys
    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      surveys = await db.select({
        ticket_id: schema.satisfactionSurveys.ticket_id,
        rating: schema.satisfactionSurveys.rating,
        responded_at: schema.satisfactionSurveys.responded_at
      })
        .from(schema.satisfactionSurveys)
        .where(inArray(schema.satisfactionSurveys.ticket_id, ticketIds.filter(id => typeof id === 'number')));
    }

    // Group tickets by department
    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    const ticketsByDept = new Map<number, typeof tickets>();
    tickets.forEach(t => {
      if (!t.department_id || typeof t.department_id !== 'number') return;
      const arr = ticketsByDept.get(t.department_id) || [];
      (arr as any).push(t);
      ticketsByDept.set(t.department_id, arr as any);
    });

    const surveysByTicket = new Map<number, { rating: number | null; responded_at: Date | null }[]>();
    surveys.forEach(s => {
      if (typeof s.ticket_id !== 'number') return;
      const arr = surveysByTicket.get(s.ticket_id) || [];
      arr.push({ rating: s.rating, responded_at: s.responded_at });
      surveysByTicket.set(s.ticket_id, arr);
    });

    // Get officials count per department
    const officialsByDept = new Map<number, number>();
    if (deptIds.length > 0) {
      const officials = await db.select({
        id: schema.officials.id,
        department_id: schema.officials.department_id
      })
        .from(schema.officials)
        .where(inArray(schema.officials.department_id, deptIds.filter(id => id !== null)));
      
      officials.forEach(o => {
        if (o.department_id && typeof o.department_id === 'number') {
          const count = officialsByDept.get(o.department_id) || 0;
          officialsByDept.set(o.department_id, count + 1);
        }
      });
    }

    // Calcular mÃ©tricas por departamento
    const incidentTypeIdForDept = incidentTypeParam && incidentTypeParam !== 'all' ? parseInt(incidentTypeParam, 10) : undefined;
    
    const departmentsMetrics = await Promise.all(
      Array.from(ticketsByDept.entries()).map(async ([deptId, ts]) => {
        if (typeof deptId !== 'number') return null;
        const total = ts.length;
        const resolved = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funÃ§Ãµes do dashboard para garantir consistÃªncia
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId as number, // departmentId especÃ­fico
          incidentTypeIdForDept
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId as number, // departmentId especÃ­fico
          incidentTypeIdForDept
        );

        // Satisfaction average for this department
        const ratings: number[] = [];
        ts.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          department_id: deptId as number,
          department_name: departmentMap.get(deptId as number) || 'N/A',
          tickets: total,
          resolved_tickets: resolved,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg,
          officials_count: officialsByDept.get(deptId) || 0
        };
      })
    );
    
    // Ordenar por tickets resolvidos
    departmentsMetrics.filter(m => m !== null).sort((a, b) => (b!.resolved_tickets - a!.resolved_tickets));

    // Summary
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.resolved_at !== null).length;
    
    const departmentIdForSummary = departmentIdParam && departmentIdParam !== 'all' ? parseInt(departmentIdParam, 10) : undefined;
    const incidentTypeIdForSummary = incidentTypeParam && incidentTypeParam !== 'all' ? parseInt(incidentTypeParam, 10) : undefined;
    
    const avgFirstResponseTimeHours = await storage.getAverageFirstResponseTimeByUserRole(
      userId, 
      userRole, 
      undefined,
      startDateParam ? new Date(startDateParam) : undefined,
      endDateParam ? new Date(endDateParam) : undefined,
      departmentIdForSummary,
      incidentTypeIdForSummary
    );
    
    const avgResolutionTimeHours = await storage.getAverageResolutionTimeByUserRole(
      userId, 
      userRole, 
      undefined,
      startDateParam ? new Date(startDateParam) : undefined,
      endDateParam ? new Date(endDateParam) : undefined,
      departmentIdForSummary,
      incidentTypeIdForSummary
    );
    
    const summary = {
      total_tickets: totalTickets,
      resolved_tickets: resolvedTickets,
      avg_first_response_time_hours: avgFirstResponseTimeHours || null,
      avg_resolution_time_hours: avgResolutionTimeHours || null,
      satisfaction_avg: (() => {
        const ratings: number[] = [];
        tickets.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        return ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;
      })()
    };

    return res.json({
      summary,
      departments: departmentsMetrics.filter(m => m !== null)
    });
  } catch (error) {
    console.error('Erro ao gerar relatÃ³rio por departamento:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatÃ³rio por departamento' });
  }
});

// Client reports
router.get('/clients', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, incidentTypeId, incident_type_id, rating } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const departmentIdParam = departmentId as string | undefined;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    const ratingParam = rating ? parseInt(rating as string, 10) : undefined;

    // Build base query for tickets
    const _baseQuery = db.select({
      id: schema.tickets.id,
      ticket_id: schema.tickets.ticket_id,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      created_at: schema.tickets.created_at,
      resolved_at: schema.tickets.resolved_at,
      updated_at: schema.tickets.updated_at,
      customer_id: schema.tickets.customer_id,
      customer_email: schema.tickets.customer_email,
      company_id: schema.tickets.company_id,
      department_id: schema.tickets.department_id
    }).from(schema.tickets);

    // Role-based filters (same logic as /performance)
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'UsuÃ¡rio nÃ£o autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager' || userRole === 'supervisor' || userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official nÃ£o encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'UsuÃ¡rio sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      roleConditions.push(inArray(schema.tickets.department_id, departmentIds));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer nÃ£o encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role nÃ£o reconhecido' });
    }

    const additionalFilters: any[] = [];
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    if (departmentIdParam && departmentIdParam !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentIdParam)));
    }
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }

    // Build where clause safely
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      const validRoleConditions = roleConditions.filter(condition => condition !== undefined && condition !== null);
      if (validRoleConditions.length > 0) {
        allConditions.push(and(...validRoleConditions));
      }
    }
    
    if (additionalFilters.length > 0) {
      const validAdditionalFilters = additionalFilters.filter(filter => filter !== undefined && filter !== null);
      if (validAdditionalFilters.length > 0) {
        allConditions.push(and(...validAdditionalFilters));
      }
    }
    
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    // Get tickets
    let ticketsQuery = db.select({
      id: schema.tickets.id,
      customer_id: schema.tickets.customer_id,
      customer_email: schema.tickets.customer_email,
      created_at: schema.tickets.created_at,
      resolved_at: schema.tickets.resolved_at,
      updated_at: schema.tickets.updated_at
    }).from(schema.tickets);
    
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause as any) as any;
    }
    
    const tickets = await ticketsQuery;

    const ticketIds = tickets.map(t => t.id);

    // Fetch customers
    const customerIds = Array.from(new Set(tickets.map(t => t.customer_id).filter(Boolean))) as number[];
    const _customerEmails = Array.from(new Set(tickets.map(t => t.customer_email).filter(Boolean))) as string[];
    
    let customers: any[] = [];
    if (customerIds.length > 0) {
      customers = await db.select({
        id: schema.customers.id,
        name: schema.customers.name,
        email: schema.customers.email
      })
        .from(schema.customers)
        .where(inArray(schema.customers.id, customerIds));
    }

    // Fetch satisfaction surveys
    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      surveys = await db.select({
        ticket_id: schema.satisfactionSurveys.ticket_id,
        customer_email: schema.satisfactionSurveys.customer_email,
        rating: schema.satisfactionSurveys.rating,
        comments: schema.satisfactionSurveys.comments,
        responded_at: schema.satisfactionSurveys.responded_at
      })
        .from(schema.satisfactionSurveys)
        .where(inArray(schema.satisfactionSurveys.ticket_id, ticketIds.filter(id => typeof id === 'number')));
    }

    // Filter by rating if specified
    if (ratingParam && !isNaN(ratingParam)) {
      const surveyTicketIds = surveys.filter(s => s.rating === ratingParam).map(s => s.ticket_id);
      if (surveyTicketIds.length > 0) {
        ticketsQuery = ticketsQuery.where(inArray(schema.tickets.id, surveyTicketIds)) as any;
      } else {
        // No tickets with this rating, return empty result
        return res.json({
          summary: {
            total_customers: 0,
            customers_responded: 0,
            satisfaction_avg: null,
            response_rate: 0
          },
          clients: [],
          rating_distribution: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
          },
          recent_comments: []
        });
      }
    }

    // Group tickets by customer (by customer_id if available, otherwise by email)
    const customerMap = new Map<number | string, { id: number | null; name: string; email: string }>();
    customers.forEach(c => {
      if (c.id) customerMap.set(c.id, { id: c.id, name: c.name, email: c.email });
    });

    // Also map by email for customers without ID
    tickets.forEach(t => {
      if (t.customer_id && customerMap.has(t.customer_id)) {
        // Already mapped by ID
      } else if (t.customer_email && !customerMap.has(t.customer_email)) {
        customerMap.set(t.customer_email, {
          id: t.customer_id || null,
          name: t.customer_email.split('@')[0],
          email: t.customer_email
        });
      }
    });

    const ticketsByCustomer = new Map<number | string, typeof tickets>();
    tickets.forEach(t => {
      const key = t.customer_id || t.customer_email;
      if (!key) return;
      const arr = ticketsByCustomer.get(key) || [];
      (arr as any).push(t);
      ticketsByCustomer.set(key, arr as any);
    });

    const surveysByTicket = new Map<number, { rating: number | null; comments: string | null; responded_at: Date | null; customer_email: string }>();
    surveys.forEach(s => {
      if (typeof s.ticket_id !== 'number') return;
      surveysByTicket.set(s.ticket_id, {
        rating: s.rating,
        comments: s.comments,
        responded_at: s.responded_at,
        customer_email: s.customer_email
      });
    });

    // Calculate metrics per customer
    const clientsMetrics = Array.from(ticketsByCustomer.entries()).map(([customerKey, ts]) => {
      const customerInfo = customerMap.get(customerKey) || {
        id: typeof customerKey === 'number' ? customerKey : null,
        name: typeof customerKey === 'string' ? customerKey.split('@')[0] : 'N/A',
        email: typeof customerKey === 'string' ? customerKey : ''
      };

      const totalTickets = ts.length;
      const resolvedTickets = ts.filter(t => t.resolved_at).length;
      
      // Get satisfaction ratings for this customer's tickets
      const ratings: number[] = [];
      const comments: Array<{ rating: number; comments: string; responded_at: Date; ticket_id: number }> = [];
      ts.forEach(t => {
        if (typeof t.id !== 'number') return;
        const survey = surveysByTicket.get(t.id);
        if (survey && survey.rating !== null && survey.responded_at) {
          ratings.push(survey.rating);
          if (survey.comments) {
            comments.push({
              rating: survey.rating,
              comments: survey.comments,
              responded_at: survey.responded_at,
              ticket_id: t.id
            });
          }
        }
      });

      const satisfactionAvg = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
        : null;

      // Get last interaction (most recent ticket update)
      const lastInteraction = ts.reduce((latest, t) => {
        const updated = t.updated_at || t.created_at;
        return (!latest || updated > latest) ? updated : latest;
      }, null as Date | null);

      return {
        customer_id: customerInfo.id,
        name: customerInfo.name,
        email: customerInfo.email,
        total_tickets: totalTickets,
        resolved_tickets: resolvedTickets,
        satisfaction_avg: satisfactionAvg,
        last_interaction: lastInteraction,
        surveys_count: ratings.length
      };
    });

    // Filter by rating if specified
    const filteredClients = ratingParam && !isNaN(ratingParam)
      ? clientsMetrics.filter(c => c.satisfaction_avg === ratingParam)
      : clientsMetrics;

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    surveys.forEach(s => {
      if (s.rating !== null && s.rating >= 1 && s.rating <= 5) {
        ratingDistribution[s.rating as keyof typeof ratingDistribution]++;
      }
    });

    // Get recent comments (last 10)
    // Filter by rating if specified
    let commentsToShow = surveys.filter(s => s.comments && s.responded_at);
    if (ratingParam && !isNaN(ratingParam)) {
      commentsToShow = commentsToShow.filter(s => s.rating === ratingParam);
    }
    const recentComments = commentsToShow
      .sort((a, b) => {
        const dateA = a.responded_at ? new Date(a.responded_at).getTime() : 0;
        const dateB = b.responded_at ? new Date(b.responded_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10)
      .map(s => ({
        rating: s.rating || 0,
        comments: s.comments || '',
        responded_at: s.responded_at,
        customer_email: s.customer_email
      }));

    // Summary
    const totalCustomers = new Set(filteredClients.map(c => c.email)).size;
    const customersResponded = new Set(
      filteredClients.filter(c => c.satisfaction_avg !== null).map(c => c.email)
    ).size;

    const allRatings: number[] = [];
    filteredClients.forEach(c => {
      if (c.satisfaction_avg !== null) {
        allRatings.push(c.satisfaction_avg);
      }
    });

    const satisfactionAvg = allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 100) / 100
      : null;

    const responseRate = totalCustomers > 0
      ? Math.round((customersResponded / totalCustomers) * 100)
      : 0;

    return res.json({
      summary: {
        total_customers: totalCustomers,
        customers_responded: customersResponded,
        satisfaction_avg: satisfactionAvg,
        response_rate: responseRate
      },
      clients: filteredClients.sort((a, b) => {
        // Sort by last interaction (most recent first)
        const dateA = a.last_interaction ? new Date(a.last_interaction).getTime() : 0;
        const dateB = b.last_interaction ? new Date(b.last_interaction).getTime() : 0;
        return dateB - dateA;
      }),
      rating_distribution: ratingDistribution,
      recent_comments: recentComments
    });
  } catch (error) {
    console.error('Erro ao gerar relatÃ³rio de clientes:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatÃ³rio de clientes' });
  }
});

// Sector reports - Relatórios por Setor do Solicitante
router.get('/sectors', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, department_id, incidentTypeId, incident_type_id, sectorId, sector_id } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const departmentIdParam = (department_id || departmentId) as string | undefined;
    const incidentTypeParam = (incident_type_id as string) || (incidentTypeId as string) || undefined;
    const sectorIdParam = (sector_id || sectorId) as string | undefined;

    // Role-based filters (same logic as /department)
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const roleConditions: any[] = [];

    if (userRole === 'admin') {
      // No additional filters
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: 'Usuário sem empresa definida' });
      }
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official não encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Manager sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'supervisor') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official não encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Supervisor sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.supervisor_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        subordinateIds.length > 0 ? inArray(schema.tickets.assigned_to_id, subordinateIds) : sql`false`,
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'support') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: 'Official não encontrado' });
      }
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: 'Support sem departamentos' });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      const assignmentFilter = or(
        eq(schema.tickets.assigned_to_id, official.id),
        isNull(schema.tickets.assigned_to_id)
      );
      roleConditions.push(and(inArray(schema.tickets.department_id, departmentIds), assignmentFilter));
    } else if (userRole === 'customer') {
      const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.user_id, userId));
      if (!customer) {
        return res.status(403).json({ message: 'Customer não encontrado' });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: 'Role não reconhecido' });
    }

    const additionalFilters: any[] = [];
    if (startDateParam) {
      additionalFilters.push(gte(schema.tickets.created_at, new Date(startDateParam)));
    }
    if (endDateParam) {
      additionalFilters.push(lte(schema.tickets.created_at, new Date(endDateParam)));
    }
    if (departmentIdParam && departmentIdParam !== 'all') {
      const departmentIdNumber = parseInt(departmentIdParam, 10);
      if (!Number.isNaN(departmentIdNumber)) {
        additionalFilters.push(eq(schema.tickets.department_id, departmentIdNumber));
      }
    }
    if (incidentTypeParam && incidentTypeParam !== 'all') {
      const incidentTypeIdNumber = parseInt(incidentTypeParam, 10);
      if (!Number.isNaN(incidentTypeIdNumber)) {
        additionalFilters.push(eq(schema.tickets.incident_type_id, incidentTypeIdNumber));
      }
    }

    // Build where clause safely
    const allConditions = [];
    
    if (roleConditions.length > 0) {
      const validRoleConditions = roleConditions.filter(condition => condition !== undefined && condition !== null);
      if (validRoleConditions.length > 0) {
        allConditions.push(and(...validRoleConditions));
      }
    }
    
    if (additionalFilters.length > 0) {
      const validAdditionalFilters = additionalFilters.filter(filter => filter !== undefined && filter !== null);
      if (validAdditionalFilters.length > 0) {
        allConditions.push(and(...validAdditionalFilters));
      }
    }
    
    const whereClause = allConditions.length > 0 ? and(...allConditions) : undefined;

    // Get tickets with customer_id for sector lookup
    const selectFields = {
      id: schema.tickets.id,
      customer_id: schema.tickets.customer_id,
      department_id: schema.tickets.department_id,
      created_at: schema.tickets.created_at,
      first_response_at: schema.tickets.first_response_at,
      resolved_at: schema.tickets.resolved_at
    };

    let ticketsQuery = db.select(selectFields).from(schema.tickets);
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause as any) as any;
    }
    
    const tickets = await ticketsQuery;

    // Fetch customer → sector mapping
    const customerIds = Array.from(new Set(tickets.map(t => t.customer_id).filter(Boolean))) as number[];
    let customerSectorMap = new Map<number, number | null>();
    
    if (customerIds.length > 0) {
      const customers = await db.select({
        id: schema.customers.id,
        sector_id: schema.customers.sector_id
      })
        .from(schema.customers)
        .where(inArray(schema.customers.id, customerIds));
      
      customers.forEach(c => {
        customerSectorMap.set(c.id, c.sector_id);
      });
    }

    // Apply sector filter if provided
    let filteredTickets = tickets;
    if (sectorIdParam && sectorIdParam !== 'all') {
      const sectorIdNumber = parseInt(sectorIdParam, 10);
      if (!Number.isNaN(sectorIdNumber)) {
        filteredTickets = tickets.filter(t => {
          if (!t.customer_id) return false;
          return customerSectorMap.get(t.customer_id) === sectorIdNumber;
        });
      }
    }

    // Group tickets by sector
    const ticketsBySector = new Map<number, typeof filteredTickets>();
    const ticketsWithoutSector: typeof filteredTickets = [];
    
    filteredTickets.forEach(t => {
      if (!t.customer_id) {
        ticketsWithoutSector.push(t);
        return;
      }
      const sectorId = customerSectorMap.get(t.customer_id);
      if (!sectorId) {
        ticketsWithoutSector.push(t);
        return;
      }
      const arr = ticketsBySector.get(sectorId) || [];
      arr.push(t);
      ticketsBySector.set(sectorId, arr);
    });

    // Fetch sector names
    const sectorIds = Array.from(ticketsBySector.keys());
    let sectorMap = new Map<number, string>();
    
    if (sectorIds.length > 0) {
      const sectorsData = await db.select({
        id: schema.sectors.id,
        name: schema.sectors.name
      })
        .from(schema.sectors)
        .where(inArray(schema.sectors.id, sectorIds));
      
      sectorsData.forEach(s => {
        sectorMap.set(s.id, s.name);
      });
    }

    // Fetch satisfaction surveys for all ticket IDs
    const allTicketIds = filteredTickets.map(t => t.id);
    let surveysByTicket = new Map<number, { rating: number | null; responded_at: Date | null }[]>();
    
    if (allTicketIds.length > 0) {
      const surveys = await db.select({
        ticket_id: schema.satisfactionSurveys.ticket_id,
        rating: schema.satisfactionSurveys.rating,
        responded_at: schema.satisfactionSurveys.responded_at
      })
        .from(schema.satisfactionSurveys)
        .where(inArray(schema.satisfactionSurveys.ticket_id, allTicketIds.filter(id => typeof id === 'number')));
      
      surveys.forEach(s => {
        if (typeof s.ticket_id !== 'number') return;
        const arr = surveysByTicket.get(s.ticket_id) || [];
        arr.push({ rating: s.rating, responded_at: s.responded_at });
        surveysByTicket.set(s.ticket_id, arr);
      });
    }

    // Count unique customers per sector
    const customerCountBySector = new Map<number, number>();
    ticketsBySector.forEach((sectorTickets, secId) => {
      const uniqueCustomers = new Set(sectorTickets.map(t => t.customer_id).filter(Boolean));
      customerCountBySector.set(secId, uniqueCustomers.size);
    });

    // Calculate metrics per sector
    const incidentTypeIdForSector = incidentTypeParam && incidentTypeParam !== 'all' ? parseInt(incidentTypeParam, 10) : undefined;
    const departmentIdForSector = departmentIdParam && departmentIdParam !== 'all' ? parseInt(departmentIdParam, 10) : undefined;
    
    const sectorsMetrics = await Promise.all(
      Array.from(ticketsBySector.entries()).map(async ([secId, ts]) => {
        const total = ts.length;
        const resolved = ts.filter(t => t.resolved_at).length;
        
        // Calculate avg first response and resolution time from ticket data directly
        const responseTimes: number[] = [];
        const resolutionTimes: number[] = [];
        
        ts.forEach(t => {
          if (t.first_response_at && t.created_at) {
            const diffHours = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            if (diffHours >= 0) responseTimes.push(diffHours);
          }
          if (t.resolved_at && t.created_at) {
            const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
            if (diffHours >= 0) resolutionTimes.push(diffHours);
          }
        });

        const avgFirstResponseHours = responseTimes.length > 0
          ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100
          : null;
        
        const avgResolutionHours = resolutionTimes.length > 0
          ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 100) / 100
          : null;

        // Satisfaction average for this sector
        const ratings: number[] = [];
        ts.forEach(t => {
          if (typeof t.id !== 'number') return;
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          sector_id: secId,
          sector_name: sectorMap.get(secId) || 'N/A',
          tickets: total,
          resolved_tickets: resolved,
          avg_first_response_time_hours: avgFirstResponseHours,
          avg_resolution_time_hours: avgResolutionHours,
          satisfaction_avg: satisfactionAvg,
          customers_count: customerCountBySector.get(secId) || 0
        };
      })
    );
    
    // Sort by tickets descending
    sectorsMetrics.sort((a, b) => b.tickets - a.tickets);

    // Add "Sem Setor" entry if there are tickets without sector
    if (ticketsWithoutSector.length > 0) {
      const resolved = ticketsWithoutSector.filter(t => t.resolved_at).length;
      
      const responseTimes: number[] = [];
      const resolutionTimes: number[] = [];
      ticketsWithoutSector.forEach(t => {
        if (t.first_response_at && t.created_at) {
          const diffHours = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          if (diffHours >= 0) responseTimes.push(diffHours);
        }
        if (t.resolved_at && t.created_at) {
          const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
          if (diffHours >= 0) resolutionTimes.push(diffHours);
        }
      });

      const ratings: number[] = [];
      ticketsWithoutSector.forEach(t => {
        if (typeof t.id !== 'number') return;
        const entries = surveysByTicket.get(t.id) || [];
        entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
      });

      const uniqueCustomers = new Set(ticketsWithoutSector.map(t => t.customer_id).filter(Boolean));

      sectorsMetrics.push({
        sector_id: 0,
        sector_name: 'Sem Setor',
        tickets: ticketsWithoutSector.length,
        resolved_tickets: resolved,
        avg_first_response_time_hours: responseTimes.length > 0
          ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 100) / 100
          : null,
        avg_resolution_time_hours: resolutionTimes.length > 0
          ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 100) / 100
          : null,
        satisfaction_avg: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null,
        customers_count: uniqueCustomers.size
      });
    }

    // Summary
    const totalTickets = filteredTickets.length;
    const resolvedTickets = filteredTickets.filter(t => t.resolved_at !== null).length;
    
    const summaryResponseTimes: number[] = [];
    const summaryResolutionTimes: number[] = [];
    filteredTickets.forEach(t => {
      if (t.first_response_at && t.created_at) {
        const diffHours = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        if (diffHours >= 0) summaryResponseTimes.push(diffHours);
      }
      if (t.resolved_at && t.created_at) {
        const diffHours = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        if (diffHours >= 0) summaryResolutionTimes.push(diffHours);
      }
    });

    const summaryRatings: number[] = [];
    filteredTickets.forEach(t => {
      if (typeof t.id !== 'number') return;
      const entries = surveysByTicket.get(t.id) || [];
      entries.forEach(e => { if (e.rating != null && e.responded_at) summaryRatings.push(e.rating as number); });
    });

    const summary = {
      total_tickets: totalTickets,
      resolved_tickets: resolvedTickets,
      avg_first_response_time_hours: summaryResponseTimes.length > 0
        ? Math.round((summaryResponseTimes.reduce((a, b) => a + b, 0) / summaryResponseTimes.length) * 100) / 100
        : null,
      avg_resolution_time_hours: summaryResolutionTimes.length > 0
        ? Math.round((summaryResolutionTimes.reduce((a, b) => a + b, 0) / summaryResolutionTimes.length) * 100) / 100
        : null,
      satisfaction_avg: summaryRatings.length > 0
        ? Math.round((summaryRatings.reduce((a, b) => a + b, 0) / summaryRatings.length) * 100) / 100
        : null
    };

    return res.json({
      summary,
      sectors: sectorsMetrics
    });
  } catch (error) {
    console.error('Erro ao gerar relatório por setor:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatório por setor' });
  }
});

export default router;
