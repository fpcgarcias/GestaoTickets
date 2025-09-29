import express from 'express';
import { Router } from 'express';
import { Request, Response } from 'express';
import { authRequired, adminRequired, companyAdminRequired, managerRequired, supervisorRequired } from '../middleware/authorization';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, and, or, gte, lte, isNull, inArray, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import puppeteer from 'puppeteer';
import { calculateEffectiveBusinessTime, getBusinessHoursConfig, convertStatusHistoryToPeriods } from '@shared/utils/sla-calculator';
import { type TicketStatus } from '@shared/ticket-utils';
import { storage } from '../storage';

const router = Router();

// Função para traduzir status de tickets para português
function translateTicketStatus(status: string): string {
  const translations: Record<string, string> = {
    'new': 'Novo',
    'ongoing': 'Em Andamento', 
    'suspended': 'Suspenso',
    'waiting_customer': 'Aguardando Cliente',
    'escalated': 'Escalado',
    'in_analysis': 'Em Análise',
    'pending_deployment': 'Aguardando Deploy',
    'reopened': 'Reaberto',
    'resolved': 'Resolvido',
    // Valores especiais
    'undefined': 'Não Definido',
    'null': 'Não Definido',
    '': 'Não Definido'
  };
  
  return translations[status] || status;
}

// Função utilitária para normalizar prioridade (primeira letra maiúscula, resto minúsculo)
// IGUAL ao dashboard.tsx para consistência total
function normalizarPrioridade(prioridade: string) {
  if (!prioridade) return '';
  return prioridade.charAt(0).toUpperCase() + prioridade.slice(1).toLowerCase();
}

// Função para formatar data/hora em português brasileiro
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
    
    // Verificar se a data é válida
    if (isNaN(data.getTime())) {
      console.warn('Data inválida:', dataInput);
      return '';
    }
    
    // Formatação ULTRA simples - sem complicações
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
function generatePDFHTML(headers: string[], rows: any[][], reportTitle: string = 'Relatório de Chamados'): string {
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
      } else if (header === 'Atribuído a') {
        if (value === 'N/A' || value === '' || !value) {
          value = 'Não Atribuído';
        }
      } else if (header === 'Criado em' || header === 'Resolvido em') {
        // As datas já vêm formatadas do backend, não precisa formatar novamente
        if (header === 'Resolvido em' && (value === 'N/A' || value === '' || !value)) {
          value = 'Não resolvido';
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
      <h1>📋 ${reportTitle}</h1>
      <table>
        <thead>
          <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        <strong>Relatório gerado em:</strong> ${new Date().toLocaleString('pt-BR', {
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
    const { startDate, endDate, start_date, end_date, status, priority, departmentId, companyId } = req.query;
    
    // Usar start_date e end_date se disponíveis (compatibilidade com dashboard)
    const startDateParam = start_date || startDate;
    const endDateParam = end_date || endDate;
    
    console.log('Reports - Query params:', { startDateParam, endDateParam, status, priority, departmentId });
    
    // Build base query - versão simples sem joins complexos
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

    // Apply role-based filters - IGUAL À TELA DE TICKETS
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;
    
    console.log('Reports - User info:', { userId, userRole });
    
    if (!userId || !userRole) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    let roleConditions: any[] = [];
    
    if (userRole === 'admin') {
      // Admin vê tudo - sem filtros
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: "Usuário sem empresa definida" });
      }
      console.log('Reports - Company Admin - Company ID:', user.company_id);
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official não encontrado" });
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
      
      // Manager vê: tickets dos seus departamentos E (atribuídos a ele OU subordinados OU não atribuídos)
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
        return res.status(403).json({ message: "Official não encontrado" });
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
      
      // Supervisor vê: tickets dos seus departamentos E (atribuídos a ele OU subordinados OU não atribuídos)
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
        return res.status(403).json({ message: "Official não encontrado" });
      }
      
      // Buscar departamentos do support
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Support sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Support vê apenas: tickets dos seus departamentos E (atribuídos a ele OU não atribuídos)
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
        return res.status(403).json({ message: "Customer não encontrado" });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: "Role não reconhecido" });
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
      additionalFilters.push(eq(schema.tickets.status, status as any));
    }

    if (priority && priority !== 'all') {
      additionalFilters.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    // Combinar TODAS as condições (role + filtros) em uma única cláusula WHERE
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

    // Fetch officials (NÃO users - assigned_to_id aponta para officials.id!)
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
      // Buscar informações da prioridade do departamento
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
    const closedTickets = processedTickets.filter(t => t.status === 'resolved').length; // usando resolved como closed

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
    console.error('Erro ao gerar relatório de tickets:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório de tickets' });
  }
});

// Export tickets to multiple formats
router.get('/tickets/export', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, status, priority, departmentId, companyId, format = 'csv' } = req.query;
    
    // Usar start_date e end_date se disponíveis (compatibilidade com dashboard)
    const startDateParam = start_date || startDate;
    const endDateParam = end_date || endDate;
    
    // Build base query - versão simples sem joins complexos
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

    // Apply role-based filters - IGUAL À TELA DE TICKETS
    const userId = req.session.userId;
    const userRole = req.session.userRole as string;
    
    console.log('Reports - User info:', { userId, userRole });
    
    if (!userId || !userRole) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    
    let roleConditions: any[] = [];
    
    if (userRole === 'admin') {
      // Admin vê tudo - sem filtros
    } else if (userRole === 'company_admin') {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      if (!user || !user.company_id) {
        return res.status(403).json({ message: "Usuário sem empresa definida" });
      }
      console.log('Reports - Company Admin - Company ID:', user.company_id);
      roleConditions.push(eq(schema.tickets.company_id, user.company_id));
    } else if (userRole === 'manager') {
      const [official] = await db.select().from(schema.officials).where(eq(schema.officials.user_id, userId));
      if (!official) {
        return res.status(403).json({ message: "Official não encontrado" });
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
      
      // Manager vê: tickets dos seus departamentos E (atribuídos a ele OU subordinados OU não atribuídos)
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
        return res.status(403).json({ message: "Official não encontrado" });
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
      
      // Supervisor vê: tickets dos seus departamentos E (atribuídos a ele OU subordinados OU não atribuídos)
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
        return res.status(403).json({ message: "Official não encontrado" });
      }
      
      // Buscar departamentos do support
      const officialDepts = await db.select().from(schema.officialDepartments)
        .where(eq(schema.officialDepartments.official_id, official.id));
      if (officialDepts.length === 0) {
        return res.status(403).json({ message: "Support sem departamentos" });
      }
      const departmentIds = officialDepts.map(od => od.department_id);
      
      // Support vê apenas: tickets dos seus departamentos E (atribuídos a ele OU não atribuídos)
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
        return res.status(403).json({ message: "Customer não encontrado" });
      }
      roleConditions.push(eq(schema.tickets.customer_id, customer.id));
    } else {
      return res.status(403).json({ message: "Role não reconhecido" });
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
      additionalFilters.push(eq(schema.tickets.status, status as any));
    }

    if (priority && priority !== 'all') {
      additionalFilters.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      additionalFilters.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    // Combinar TODAS as condições (role + filtros) em uma única cláusula WHERE
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

    // Fetch officials (NÃO users - assigned_to_id aponta para officials.id!)
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
      // Buscar informações da prioridade do departamento
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
              assigned_to_name: ticket.assigned_to_id ? officialMap.get(ticket.assigned_to_id)?.name || 'N/A' : 'Não atribuído',
      assigned_to_email: ticket.assigned_to_id ? officialMap.get(ticket.assigned_to_id)?.email || '' : '',
        priority_weight: priorityInfo?.weight,
        priority_color: priorityInfo?.color,
        priority_name: priorityInfo?.name
      };
    });

    // Generate data for export - ONLY fields shown on screen
    const exportHeaders = [
      'Ticket ID', 
      'Título', 
      'Cliente', 
      'Departamento', 
      'Atribuído a', 
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
      ticket.assigned_to_name === 'N/A' || !ticket.assigned_to_name ? 'Não Atribuído' : `"${ticket.assigned_to_name.replace(/"/g, '""')}"`,
      translateTicketStatus(ticket.status),
      ticket.priority_name || normalizarPrioridade(ticket.priority),
      formatarDataHora(ticket.created_at),
      ticket.resolved_at ? formatarDataHora(ticket.resolved_at) : 'Não resolvido'
    ]);

    // Generate output based on format
    const exportFormat = (format as string).toLowerCase();
    
    if (exportFormat === 'excel') {
      // Excel export with proper formatting - ONLY screen fields
      const workbook = XLSX.utils.book_new();
      
      // Prepare data with proper types for Excel - ONLY screen fields
      const excelData = processedTickets.map(ticket => ({
        'Ticket ID': ticket.ticket_id,
        'Título': ticket.title,
        'Cliente': ticket.customer_name,
        'Departamento': ticket.department_name,
        'Atribuído a': ticket.assigned_to_name === 'N/A' || !ticket.assigned_to_name ? 'Não Atribuído' : ticket.assigned_to_name,
        'Status': translateTicketStatus(ticket.status),
        'Prioridade': ticket.priority_name || normalizarPrioridade(ticket.priority),
        'Criado em': formatarDataHora(ticket.created_at),
        'Resolvido em': ticket.resolved_at ? formatarDataHora(ticket.resolved_at) : 'Não resolvido'
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths - ONLY screen fields
      const colWidths = [
        { wch: 15 },  // Ticket ID
        { wch: 35 },  // Título
        { wch: 25 },  // Cliente
        { wch: 20 },  // Departamento
        { wch: 25 },  // Atribuído a
        { wch: 12 },  // Status
        { wch: 12 },  // Prioridade
        { wch: 18 },  // Criado em
        { wch: 18 }   // Resolvido em
      ];
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de Chamados');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
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
          details: pdfError?.message || 'Erro desconhecido na geração do PDF'
        });
      }
      
    } else {
      // Formato não suportado
      return res.status(400).json({ 
        error: 'Formato não suportado. Use: excel ou pdf' 
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
    const { startDate, endDate, start_date, end_date, departmentId, companyId, showInactiveOfficials } = req.query;

    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const showInactiveOfficialsParam = showInactiveOfficials === 'true';

    // Build base query for tickets
    let baseQuery = db.select({
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
    if (departmentId) {
      additionalFilters.push(eq(schema.tickets.department_id, Number(departmentId)));
    }
    if (companyId) {
      additionalFilters.push(eq(schema.tickets.company_id, Number(companyId)));
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
      throw new Error('Schema de tickets não encontrado');
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
      }).filter(([key, value]) => value !== undefined && value !== null)
    );

    // Validate that we have valid select fields
    if (!selectFields || Object.keys(selectFields).length === 0) {
      throw new Error('Campos de seleção inválidos para tickets');
    }

    // Build the base query with validation
    let ticketsQuery = db.select(selectFields).from(schema.tickets);
    
    // Apply where clause if it exists
    if (whereClause) {
      ticketsQuery = ticketsQuery.where(whereClause);
    }
    
    const tickets = await ticketsQuery;

    // Collect IDs first
    const ticketIds = tickets.map(t => t.id);

    // Fetch status history for all tickets to calculate effective business time
    let statusHistories: any[] = [];
    if (ticketIds.length > 0) {
      // Validate schema before using it
      if (!schema.ticketStatusHistory) {
        throw new Error('Schema de histórico de status não encontrado');
      }

      const statusHistorySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.ticketStatusHistory.ticket_id,
          status: schema.ticketStatusHistory.status,
          created_at: schema.ticketStatusHistory.created_at
        }).filter(([key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(statusHistorySelectFields).length === 0) {
        throw new Error('Campos de seleção inválidos para histórico de status');
      }
      
      statusHistories = await db.select(statusHistorySelectFields)
        .from(schema.ticketStatusHistory)
        .where(inArray(schema.ticketStatusHistory.ticket_id, ticketIds))
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
    const businessHours = getBusinessHoursConfig();
    const deptIds = Array.from(new Set(tickets.map(t => t.department_id).filter(Boolean))) as number[];
    const officialIds = Array.from(new Set(tickets.map(t => t.assigned_to_id).filter(Boolean))) as number[];

    // Fetch lookup data
    let departments: any[] = [];
    if (deptIds.length > 0) {
      // Validate schema before using it
      if (!schema.departments) {
        throw new Error('Schema de departamentos não encontrado');
      }

      const departmentSelectFields = Object.fromEntries(
        Object.entries({
          id: schema.departments.id,
          name: schema.departments.name
        }).filter(([key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(departmentSelectFields).length === 0) {
        throw new Error('Campos de seleção inválidos para departamentos');
      }
      
      departments = await db.select(departmentSelectFields)
        .from(schema.departments)
        .where(inArray(schema.departments.id, deptIds));
    }

    let officials: any[] = [];
    if (officialIds.length > 0) {
      // Validate schema before using it
      if (!schema.officials) {
        throw new Error('Schema de funcionários não encontrado');
      }

      const officialSelectFields = Object.fromEntries(
        Object.entries({
          id: schema.officials.id,
          name: schema.officials.name,
          email: schema.officials.email
        }).filter(([key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(officialSelectFields).length === 0) {
        throw new Error('Campos de seleção inválidos para funcionários');
      }
      
      officials = await db.select(officialSelectFields)
        .from(schema.officials)
        .where(inArray(schema.officials.id, officialIds));
    }

    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      // Validate schema before using it
      if (!schema.satisfactionSurveys) {
        throw new Error('Schema de pesquisas de satisfação não encontrado');
      }

      const surveySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.satisfactionSurveys.ticket_id,
          rating: schema.satisfactionSurveys.rating,
          responded_at: schema.satisfactionSurveys.responded_at
        }).filter(([key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(surveySelectFields).length === 0) {
        throw new Error('Campos de seleção inválidos para pesquisas de satisfação');
      }
      
      surveys = await db.select(surveySelectFields)
        .from(schema.satisfactionSurveys)
        .where(inArray(schema.satisfactionSurveys.ticket_id, ticketIds));
    }

    // As funções helper foram removidas - agora usamos as funções do storage que são as mesmas do dashboard

    // Group by official
    const officialMap = new Map(officials.map(o => [o.id, { name: o.name, email: o.email }]));
    const ticketsByOfficial = new Map<number, typeof tickets>();
    tickets.forEach(t => {
      if (!t.assigned_to_id) return;
      const arr = ticketsByOfficial.get(t.assigned_to_id) || [];
      (arr as any).push(t);
      ticketsByOfficial.set(t.assigned_to_id, arr as any);
    });

    const surveysByTicket = new Map<number, { rating: number | null; responded_at: Date | null }[]>();
    surveys.forEach(s => {
      const arr = surveysByTicket.get(s.ticket_id) || [];
      arr.push({ rating: s.rating, responded_at: s.responded_at });
      surveysByTicket.set(s.ticket_id, arr);
    });

    // Calcular métricas por atendente usando as mesmas funções do dashboard
    const officialsMetrics = await Promise.all(
      Array.from(ticketsByOfficial.entries()).map(async ([officialId, ts]) => {
        const ticketsAssigned = ts.length;
        const resolvedTickets = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funções do dashboard para garantir consistência
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          officialId, // officialId específico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentId ? Number(departmentId) : undefined
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          officialId, // officialId específico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentId ? Number(departmentId) : undefined
        );

        // Satisfaction average for this official (tickets currently assigned to the official)
        let ratings: number[] = [];
        ts.forEach(t => {
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          official_id: officialId,
          name: officialMap.get(officialId)?.name || 'N/A',
          email: officialMap.get(officialId)?.email || '',
          tickets_assigned: ticketsAssigned,
          tickets_resolved: resolvedTickets,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );
    
    // Ordenar por tickets resolvidos
    officialsMetrics.sort((a, b) => (b.tickets_resolved - a.tickets_resolved));

    // Group by department
    const departmentMap = new Map(departments.map(d => [d.id, d.name]));
    const ticketsByDept = new Map<number, typeof tickets>();
    tickets.forEach(t => {
      if (!t.department_id) return;
      const arr = ticketsByDept.get(t.department_id) || [];
      (arr as any).push(t);
      ticketsByDept.set(t.department_id, arr as any);
    });

    // Calcular métricas por departamento usando as mesmas funções do dashboard
    const departmentsMetrics = await Promise.all(
      Array.from(ticketsByDept.entries()).map(async ([deptId, ts]) => {
        const total = ts.length;
        const resolved = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funções do dashboard para garantir consistência
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId // departmentId específico
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          undefined, // officialId - usar undefined para todos os atendentes do departamento
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          deptId // departmentId específico
        );

        // Satisfaction average for this department
        let ratings: number[] = [];
        ts.forEach(t => {
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          department_id: deptId,
          department_name: departmentMap.get(deptId) || 'N/A',
          tickets: total,
          resolved_tickets: resolved,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );
    
    // Ordenar por tickets resolvidos
    departmentsMetrics.sort((a, b) => (b.resolved_tickets - a.resolved_tickets));

    // Summary - USAR AS MESMAS FUNÇÕES DO DASHBOARD
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.resolved_at).length;
    
    // Usar as mesmas funções do dashboard para garantir consistência
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
        let ratings: number[] = [];
        tickets.forEach(t => {
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        return ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;
      })()
    };

    return res.json({
      summary,
      officials: officialsMetrics,
      departments: departmentsMetrics
    });
  } catch (error) {
    console.error('Erro ao gerar relatório de performance:', error);
    return res.status(500).json({ message: 'Erro ao gerar relatório de performance' });
  }
});

// Export performance report to multiple formats
router.get('/performance/export', authRequired, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, start_date, end_date, departmentId, companyId, showInactiveOfficials, format = 'csv' } = req.query;
    
    const startDateParam = (start_date || startDate) as string | undefined;
    const endDateParam = (end_date || endDate) as string | undefined;
    const departmentIdParam = departmentId as string | undefined;
    const companyIdParam = companyId as string | undefined;
    const showInactiveOfficialsParam = showInactiveOfficials === 'true';

    // Build base query for tickets - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    let baseQuery = db.select({
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
      
      // Buscar subordinados do manager
      const subordinates = await db.select().from(schema.officials)
        .where(eq(schema.officials.manager_id, official.id));
      const subordinateIds = subordinates.map(s => s.id);
      
      // Manager vê: tickets dos seus departamentos E (atribuídos a ele OU subordinados OU não atribuídos)
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
        return res.status(403).json({ message: 'Official não encontrado' });
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
        }).filter(([key, value]) => value !== undefined && value !== null)
      );
      
      if (Object.keys(officialSelectFields).length > 0) {
        officials = await db.select(officialSelectFields)
          .from(schema.officials)
          .where(inArray(schema.officials.id, officialIds));
      }
    }

    // Buscar dados de satisfação - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const ticketIds = tickets.map(t => t.id);
    let surveys: any[] = [];
    if (ticketIds.length > 0) {
      const surveySelectFields = Object.fromEntries(
        Object.entries({
          ticket_id: schema.satisfactionSurveys.ticket_id,
          rating: schema.satisfactionSurveys.rating,
          responded_at: schema.satisfactionSurveys.responded_at
        }).filter(([key, value]) => value !== undefined && value !== null)
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
      const arr = surveysByTicket.get(s.ticket_id) || [];
      arr.push({ rating: s.rating, responded_at: s.responded_at });
      surveysByTicket.set(s.ticket_id, arr);
    });

    // Calcular métricas por atendente usando as mesmas funções do dashboard - EXATAMENTE IGUAL AO ENDPOINT PRINCIPAL
    const officialsMetrics = await Promise.all(
      Array.from(ticketsByOfficial.entries()).map(async ([officialId, ts]) => {
        const ticketsAssigned = ts.length;
        const resolvedTickets = ts.filter(t => t.resolved_at).length;
        
        // Usar as mesmas funções do dashboard para garantir consistência
        const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
          userId, 
          userRole, 
          officialId, // officialId específico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentIdParam ? Number(departmentIdParam) : undefined
        );
        
        const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
          userId, 
          userRole, 
          officialId, // officialId específico
          startDateParam ? new Date(startDateParam) : undefined,
          endDateParam ? new Date(endDateParam) : undefined,
          departmentIdParam ? Number(departmentIdParam) : undefined
        );

        // Satisfaction average for this official (tickets currently assigned to the official)
        let ratings: number[] = [];
        ts.forEach(t => {
          const entries = surveysByTicket.get(t.id) || [];
          entries.forEach(e => { if (e.rating != null && e.responded_at) ratings.push(e.rating as number); });
        });
        const satisfactionAvg = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;

        return {
          official_id: officialId,
          official_name: officialId ? (officialMap.get(officialId)?.name || 'Atendente') : 'Não atribuído',
          official_active: true, // Simplificado para export
          tickets_assigned: ticketsAssigned,
          resolved_tickets: resolvedTickets,
          avg_first_response_time_hours: avgFirstResponseHours || null,
          avg_resolution_time_hours: avgResolutionHours || null,
          satisfaction_avg: satisfactionAvg
        };
      })
    );

    // Filter out inactive officials if needed - APÓS O CÁLCULO
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
      'Tickets Atribuídos',
      'Tickets Resolvidos',
      'Tempo Médio 1ª Resposta (h)',
      'Tempo Médio Resolução (h)',
      'Satisfação Média'
    ];

    // Função para formatar tempo igual ao dashboard (TimeMetricCard)
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
        { width: 15 }, // Tickets Atribuídos
        { width: 15 }, // Tickets Resolvidos
        { width: 20 }, // Tempo Médio 1ª Resposta
        { width: 20 }, // Tempo Médio Resolução
        { width: 15 }  // Satisfação Média
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
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório Performance');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio-performance.xlsx');
      return res.end(buffer);
      
    } else if (exportFormat === 'pdf') {
      // PDF export with proper binary handling
      console.log('Starting PDF generation for performance report...');
      const htmlContent = generatePDFHTML(exportHeaders, exportRows, 'Relatório de Performance');
      console.log('HTML content generated, length:', htmlContent.length);
      
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
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
  res.json({ message: 'SLA reports endpoint - to be implemented' });
});

// Department reports
router.get('/department', authRequired, async (req: Request, res: Response) => {
  res.json({ message: 'Department reports endpoint - to be implemented' });
});

// Client reports
router.get('/clients', authRequired, async (req: Request, res: Response) => {
  res.json({ message: 'Client reports endpoint - to be implemented' });
});

export default router;