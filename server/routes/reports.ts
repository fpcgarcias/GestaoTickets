import express from 'express';
import { Router } from 'express';
import { Request, Response } from 'express';
import { authRequired, adminRequired, companyAdminRequired, managerRequired, supervisorRequired } from '../middleware/authorization';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, and, or, gte, lte, isNull, inArray } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import puppeteer from 'puppeteer';

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
function generatePDFHTML(headers: string[], rows: any[][]): string {
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
      <title>Relatório de Chamados</title>
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
      <h1>📋 Relatório de Chamados</h1>
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

    // Apply role-based filters
    if (req.session.userRole !== 'admin') {
      const userCompanyId = req.session.companyId || companyId;
      if (userCompanyId) {
        baseQuery = baseQuery.where(eq(schema.tickets.company_id, parseInt(userCompanyId as string))) as any;
      }
    }

    // Apply filters
    const conditions = [];

    if (startDateParam) {
      conditions.push(gte(schema.tickets.created_at, new Date(startDateParam as string)));
    }

    if (endDateParam) {
      conditions.push(lte(schema.tickets.created_at, new Date(endDateParam as string)));
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.tickets.status, status as any));
    }

    if (priority && priority !== 'all') {
      conditions.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      conditions.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
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

    // Fetch users
    const users = assignedToIds.length > 0
      ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
          .from(schema.users)
          .where(inArray(schema.users.id, assignedToIds))
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
    const userMap = new Map(users.map(u => [u.id, u]));
    
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
        assigned_to: ticket.assigned_to_id ? userMap.get(ticket.assigned_to_id) || null : null
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

    // Apply role-based filters
    if (req.session.userRole !== 'admin') {
      const userCompanyId = req.session.companyId || companyId;
      if (userCompanyId) {
        baseQuery = baseQuery.where(eq(schema.tickets.company_id, parseInt(userCompanyId as string))) as any;
      }
    }

    // Apply filters
    const conditions = [];

    if (startDateParam) {
      conditions.push(gte(schema.tickets.created_at, new Date(startDateParam as string)));
    }

    if (endDateParam) {
      conditions.push(lte(schema.tickets.created_at, new Date(endDateParam as string)));
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.tickets.status, status as any));
    }

    if (priority && priority !== 'all') {
      conditions.push(eq(schema.tickets.priority, priority as string));
    }

    if (departmentId && departmentId !== 'all') {
      conditions.push(eq(schema.tickets.department_id, parseInt(departmentId as string)));
    }

    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
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

    // Fetch users
    const users = assignedToIds.length > 0
      ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
          .from(schema.users)
          .where(inArray(schema.users.id, assignedToIds))
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
    const userMap = new Map(users.map(u => [u.id, { name: u.name, email: u.email }]));
    
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
        assigned_to_name: ticket.assigned_to_id ? userMap.get(ticket.assigned_to_id)?.name || 'N/A' : 'Não atribuído',
        assigned_to_email: ticket.assigned_to_id ? userMap.get(ticket.assigned_to_id)?.email || '' : '',
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
      const htmlContent = generatePDFHTML(exportHeaders, exportRows);
      
      let browser;
      try {
        browser = await puppeteer.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
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
        
        await browser.close();
        
        res.type('application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio-chamados.pdf');
        return res.end(pdfBuffer);
        
      } catch (pdfError) {
        if (browser) await browser.close();
        console.error('PDF generation error:', pdfError);
        return res.status(500).json({ error: 'Erro ao gerar PDF' });
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
  res.json({ message: 'Performance reports endpoint - to be implemented' });
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