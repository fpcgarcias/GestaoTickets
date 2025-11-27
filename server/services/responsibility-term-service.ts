import { db } from '../db';
import {
  inventoryTermTemplates,
  inventoryResponsibilityTerms,
  userInventoryAssignments,
  responsibilityTermAssignments,
  users,
  customers,
  inventoryProducts,
  companies,
  type InventoryTermTemplate,
  type InsertInventoryTermTemplate,
  type InventoryResponsibilityTerm,
  type InsertResponsibilityTermAssignment,
} from '@shared/schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import s3Service from './s3-service';
import { emailConfigService } from './email-config-service';

export interface TemplateInput extends Omit<InsertInventoryTermTemplate, 'company_id' | 'created_at' | 'updated_at'> {
  company_id: number;
  created_by_id?: number | null;
}

export interface GenerateTermParams {
  assignmentId?: number;
  assignmentIds?: number[];
  assignmentGroupId?: string;
  companyId: number;
  templateId?: number;
  createdById?: number | null;
}

export interface SendTermParams {
  termId: number;
  companyId: number;
  recipientEmail: string;
  recipientName?: string;
  message?: string;
  requesterRole?: string;
}

interface AssignmentContext {
  assignment: typeof userInventoryAssignments.$inferSelect;
  user?: typeof users.$inferSelect | null;
  customer?: typeof customers.$inferSelect | null;
  product?: typeof inventoryProducts.$inferSelect | null;
  company?: typeof companies.$inferSelect | null;
  deliveryResponsible?: typeof users.$inferSelect | null;
}

interface BatchAssignmentContext {
  assignments: Array<{
    assignment: typeof userInventoryAssignments.$inferSelect;
    user?: typeof users.$inferSelect | null;
    product?: typeof inventoryProducts.$inferSelect | null;
  }>;
  company?: typeof companies.$inferSelect | null;
  deliveryResponsible?: typeof users.$inferSelect | null;
}

class ResponsibilityTermService {
  async listTemplates(companyId: number): Promise<InventoryTermTemplate[]> {
    return db
      .select()
      .from(inventoryTermTemplates)
      .where(eq(inventoryTermTemplates.company_id, companyId))
      .orderBy(desc(inventoryTermTemplates.is_default), desc(inventoryTermTemplates.updated_at));
  }

  async createTemplate(input: TemplateInput): Promise<InventoryTermTemplate> {
    const template: InsertInventoryTermTemplate = {
      name: input.name,
      description: input.description,
      content: input.content,
      version: input.version ?? 1,
      is_active: input.is_active ?? true,
      is_default: input.is_default ?? false,
      company_id: input.company_id,
      created_by_id: input.created_by_id ?? null,
    };

    if (template.is_default) {
      await this.clearDefaultTemplate(input.company_id);
    }

    const [created] = await db.insert(inventoryTermTemplates).values(template).returning();
    return created;
  }

  async updateTemplate(
    templateId: number,
    companyId: number,
    updates: Partial<TemplateInput>
  ): Promise<InventoryTermTemplate> {
    const [existing] = await db
      .select()
      .from(inventoryTermTemplates)
      .where(and(
        eq(inventoryTermTemplates.id, templateId),
        eq(inventoryTermTemplates.company_id, companyId)
      ))
      .limit(1);

    if (!existing) {
      throw new Error('Template não encontrado.');
    }

    if (updates.is_default) {
      await this.clearDefaultTemplate(companyId);
    }

    const [updated] = await db
      .update(inventoryTermTemplates)
      .set({
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        content: updates.content ?? existing.content,
        is_active: updates.is_active ?? existing.is_active,
        is_default: updates.is_default ?? existing.is_default,
        version: (updates.version ?? existing.version) + (updates.content ? 1 : 0),
      })
      .where(eq(inventoryTermTemplates.id, templateId))
      .returning();

    return updated;
  }

  async setDefaultTemplate(templateId: number, companyId: number) {
    const template = await this.getTemplate(templateId, companyId);
    if (!template) {
      throw new Error('Template não encontrado.');
    }

    await this.clearDefaultTemplate(companyId);
    await db
      .update(inventoryTermTemplates)
      .set({ is_default: true })
      .where(eq(inventoryTermTemplates.id, templateId));
  }

  async generateTerm(params: GenerateTermParams): Promise<InventoryResponsibilityTerm & { pdfBase64?: string }> {
    // Se tem assignmentGroupId ou assignmentIds, é termo em lote
    if (params.assignmentGroupId || (params.assignmentIds && params.assignmentIds.length > 0)) {
      return this.generateBatchTerm(params);
    }

    // Termo único (compatibilidade com código existente)
    if (!params.assignmentId) {
      throw new Error('assignmentId é obrigatório para termo único.');
    }

    const assignmentContext = await this.getAssignmentContext(params.assignmentId, params.companyId);
    if (!assignmentContext) {
      throw new Error('Alocação não encontrada.');
    }

    const template = await this.resolveTemplate(params.templateId, params.companyId);
    if (!template) {
      throw new Error('Template não encontrado para esta empresa.');
    }

    const context = this.buildTemplateContext(assignmentContext);
    const html = this.renderTemplate(template.content, context);
    const pdfBuffer = await this.generatePdf(html);

    // Em desenvolvimento, retornar PDF como base64 para visualização direta
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let pdfBase64: string | undefined = undefined;
    if (isDevelopment) {
      pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    }

    let s3Key = `terms/${params.assignmentId}/termo-responsabilidade-${params.assignmentId}.pdf`;

    // Apenas fazer upload para S3 em produção
    if (!isDevelopment) {
      const uploadResult = await s3Service.uploadInventoryFile({
        buffer: pdfBuffer,
        originalName: `termo-responsabilidade-${params.assignmentId}.pdf`,
        companyId: params.companyId,
        folder: `terms/${params.assignmentId}`,
        mimeType: 'application/pdf',
        metadata: {
          assignmentId: params.assignmentId,
          templateId: template.id,
        },
      });
      s3Key = uploadResult.s3Key;
    }

    const [term] = await db.insert(inventoryResponsibilityTerms).values({
      assignment_id: params.assignmentId,
      template_id: template.id,
      template_version: template.version,
      pdf_s3_key: s3Key,
      generated_pdf_url: s3Key,
      status: 'pending',
      company_id: params.companyId,
      created_at: new Date(),
      updated_at: new Date(),
      is_batch_term: false,
    }).returning();

    // Atualizar assignment com o ID do termo gerado
    await db
      .update(userInventoryAssignments)
      .set({ responsibility_term_id: term.id })
      .where(eq(userInventoryAssignments.id, params.assignmentId!));

    return { ...term, pdfBase64: pdfBase64 as string | undefined };
  }

  async generateBatchTerm(params: GenerateTermParams): Promise<InventoryResponsibilityTerm & { pdfBase64?: string }> {
    let assignmentIds: number[] = [];

    if (params.assignmentGroupId) {
      // Buscar assignments pelo group_id
      const assignments = await db
        .select({ id: userInventoryAssignments.id })
        .from(userInventoryAssignments)
        .where(and(
          eq(userInventoryAssignments.assignment_group_id, params.assignmentGroupId),
          eq(userInventoryAssignments.company_id, params.companyId),
          isNull(userInventoryAssignments.actual_return_date) // Apenas assignments ativos
        ));

      assignmentIds = assignments.map(a => a.id);
    } else if (params.assignmentIds && params.assignmentIds.length > 0) {
      assignmentIds = params.assignmentIds;
    } else {
      throw new Error('É necessário informar assignmentGroupId ou assignmentIds para termo em lote.');
    }

    if (assignmentIds.length === 0) {
      throw new Error('Nenhum assignment encontrado para gerar o termo.');
    }

    const batchContext = await this.getBatchAssignmentContext(assignmentIds, params.companyId);
    if (!batchContext || batchContext.assignments.length === 0) {
      throw new Error('Alocações não encontradas.');
    }

    const template = await this.resolveTemplate(params.templateId, params.companyId);
    if (!template) {
      throw new Error('Template não encontrado para esta empresa.');
    }

    const context = await this.buildBatchTemplateContext(batchContext);
    const html = this.renderTemplate(template.content, context);
    const pdfBuffer = await this.generatePdf(html);

    // Em desenvolvimento, retornar PDF como base64 para visualização direta
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let pdfBase64: string | undefined = undefined;
    if (isDevelopment) {
      pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
    }

    const termId = `batch-${Date.now()}`;
    let s3Key = `terms/batch/${termId}/termo-responsabilidade-lote-${termId}.pdf`;

    // Apenas fazer upload para S3 em produção
    if (!isDevelopment) {
      const uploadResult = await s3Service.uploadInventoryFile({
        buffer: pdfBuffer,
        originalName: `termo-responsabilidade-lote-${termId}.pdf`,
        companyId: params.companyId,
        folder: `terms/batch/${termId}`,
        mimeType: 'application/pdf',
        metadata: {
          assignmentIds: assignmentIds,
          templateId: template.id,
          isBatch: true,
        },
      });
      s3Key = uploadResult.s3Key;
    }

    const [term] = await db.insert(inventoryResponsibilityTerms).values({
      assignment_id: null, // NULL para termos em lote
      template_id: template.id,
      template_version: template.version,
      pdf_s3_key: s3Key,
      generated_pdf_url: s3Key,
      status: 'pending',
      company_id: params.companyId,
      created_at: new Date(),
      updated_at: new Date(),
      is_batch_term: true,
    }).returning();

    // Criar relacionamentos entre termo e assignments
    const termAssignments: InsertResponsibilityTermAssignment[] = assignmentIds.map(assignmentId => ({
      term_id: term.id,
      assignment_id: assignmentId,
    }));

    await db.insert(responsibilityTermAssignments).values(termAssignments);

    // Atualizar todos os assignments com o ID do termo gerado
    await db
      .update(userInventoryAssignments)
      .set({ responsibility_term_id: term.id })
      .where(inArray(userInventoryAssignments.id, assignmentIds));

    return { ...term, pdfBase64: pdfBase64 as string | undefined };
  }

  async sendTerm(params: SendTermParams): Promise<{ success: boolean }> {
    const term = await this.getTerm(params.termId, params.companyId);
    if (!term) {
      throw new Error('Termo não encontrado.');
    }

    let userName = params.recipientName;

    // Se for termo em lote, buscar primeiro assignment para pegar o nome do usuário
    if (term.is_batch_term) {
      const termAssignments = await db
        .select({ assignment_id: responsibilityTermAssignments.assignment_id })
        .from(responsibilityTermAssignments)
        .where(eq(responsibilityTermAssignments.term_id, params.termId))
        .limit(1);

      if (termAssignments.length > 0) {
        const assignment = await this.getAssignmentContext(termAssignments[0].assignment_id, params.companyId);
        userName = userName ?? assignment?.user?.name ?? 'Responsável';
      }
    } else if (term.assignment_id) {
      const assignment = await this.getAssignmentContext(term.assignment_id, params.companyId);
      if (!assignment) {
        throw new Error('Alocação não encontrada para o termo.');
      }
      userName = userName ?? assignment.user?.name ?? 'Responsável';
    }

    if (!term.pdf_s3_key) {
      throw new Error('PDF não disponível para este termo.');
    }

    const downloadUrl = await s3Service.getDownloadUrl(term.pdf_s3_key);
    await this.sendEmailWithLink({
      to: params.recipientEmail,
      name: userName ?? 'Responsável',
      downloadUrl,
      message: params.message,
      companyId: params.companyId,
    });

    await db
      .update(inventoryResponsibilityTerms)
      .set({
        sent_date: new Date(),
        status: 'sent',
      })
      .where(eq(inventoryResponsibilityTerms.id, params.termId));

    return { success: true };
  }

  async getTermPdfUrl(termId: number, companyId: number): Promise<string> {
    const term = await this.getTerm(termId, companyId);
    if (!term) {
      throw new Error('Termo não encontrado.');
    }

    // ✅ SE JÁ ESTIVER ASSINADO, RETORNAR O PDF ASSINADO (PRIORIDADE MÁXIMA)
    if (term.signed_pdf_s3_key) {
      return s3Service.getDownloadUrl(term.signed_pdf_s3_key);
    }

    if (!term.pdf_s3_key) {
      throw new Error('PDF não encontrado.');
    }
    return s3Service.getDownloadUrl(term.pdf_s3_key);
  }

  async regenerateTermPdf(termId: number, companyId: number): Promise<Buffer> {
    // Buscar termo
    const [term] = await db
      .select({
        term: inventoryResponsibilityTerms,
        template: inventoryTermTemplates,
      })
      .from(inventoryResponsibilityTerms)
      .leftJoin(inventoryTermTemplates, eq(inventoryResponsibilityTerms.template_id, inventoryTermTemplates.id))
      .where(
        and(
          eq(inventoryResponsibilityTerms.id, termId),
          eq(inventoryResponsibilityTerms.company_id, companyId)
        )
      );

    if (!term || !term.template) {
      throw new Error('Termo ou template não encontrado.');
    }

    // Se for termo em lote
    if (term.term.is_batch_term) {
      // Buscar assignments relacionados
      const assignments = await db
        .select({
          assignment_id: responsibilityTermAssignments.assignment_id,
        })
        .from(responsibilityTermAssignments)
        .where(eq(responsibilityTermAssignments.term_id, termId));

      const assignmentIds = assignments.map(a => a.assignment_id);

      if (assignmentIds.length === 0) {
        throw new Error('Nenhuma alocação encontrada para este termo em lote.');
      }

      const batchContext = await this.getBatchAssignmentContext(assignmentIds, companyId);

      if (!batchContext) {
        throw new Error(`Dados das alocações não encontrados (IDs: ${assignmentIds.join(', ')}). Verifique se pertencem à empresa atual.`);
      }

      const context = await this.buildBatchTemplateContext(batchContext);
      const html = this.renderTemplate(term.template.content, context);
      return this.generatePdf(html);
    } else {
      // Termo individual
      if (!term.term.assignment_id) {
        throw new Error('ID da alocação não encontrado no termo.');
      }

      const assignmentContext = await this.getAssignmentContext(term.term.assignment_id, companyId);

      if (!assignmentContext) {
        throw new Error(`Dados da alocação não encontrados (ID: ${term.term.assignment_id}). Verifique se pertence à empresa atual.`);
      }

      const context = await this.buildTemplateContext(assignmentContext);
      const html = this.renderTemplate(term.template.content, context);
      return this.generatePdf(html);
    }
  }

  private async getTemplate(id: number, companyId: number) {
    const [template] = await db
      .select()
      .from(inventoryTermTemplates)
      .where(and(
        eq(inventoryTermTemplates.id, id),
        eq(inventoryTermTemplates.company_id, companyId)
      ))
      .limit(1);
    return template ?? null;
  }

  private async resolveTemplate(templateId: number | undefined, companyId: number) {
    if (templateId) {
      return this.getTemplate(templateId, companyId);
    }

    const [defaultTemplate] = await db
      .select()
      .from(inventoryTermTemplates)
      .where(and(
        eq(inventoryTermTemplates.company_id, companyId),
        eq(inventoryTermTemplates.is_default, true)
      ))
      .limit(1);

    return defaultTemplate ?? null;
  }

  private async clearDefaultTemplate(companyId: number) {
    await db
      .update(inventoryTermTemplates)
      .set({ is_default: false })
      .where(and(
        eq(inventoryTermTemplates.company_id, companyId),
        eq(inventoryTermTemplates.is_default, true)
      ));
  }

  private async getAssignmentContext(assignmentId: number, companyId: number): Promise<AssignmentContext | null> {
    const [result] = await db
      .select({
        assignment: userInventoryAssignments,
        user: users,
        product: inventoryProducts,
        company: companies,
      })
      .from(userInventoryAssignments)
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(companies, eq(userInventoryAssignments.company_id, companies.id))
      .where(and(
        eq(userInventoryAssignments.id, assignmentId),
        eq(userInventoryAssignments.company_id, companyId)
      ))
      .limit(1);

    if (!result) return null;

    // Buscar customer relacionado ao user (para telefone)
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.user_id, result.user?.id ?? 0))
      .limit(1);

    // Buscar responsável da entrega (assigned_by_id)
    let deliveryResponsible = null;
    if (result.assignment.assigned_by_id) {
      const [responsible] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.assignment.assigned_by_id))
        .limit(1);
      deliveryResponsible = responsible ?? null;
    }

    return {
      ...result,
      customer: customer ?? null,
      deliveryResponsible,
    };
  }

  private async getBatchAssignmentContext(assignmentIds: number[], companyId: number): Promise<BatchAssignmentContext | null> {
    const results = await db
      .select({
        assignment: userInventoryAssignments,
        user: users,
        product: inventoryProducts,
        company: companies,
      })
      .from(userInventoryAssignments)
      .leftJoin(users, eq(userInventoryAssignments.user_id, users.id))
      .leftJoin(inventoryProducts, eq(userInventoryAssignments.product_id, inventoryProducts.id))
      .leftJoin(companies, eq(userInventoryAssignments.company_id, companies.id))
      .where(and(
        inArray(userInventoryAssignments.id, assignmentIds),
        eq(userInventoryAssignments.company_id, companyId)
      ));

    if (results.length === 0) {
      return null;
    }

    const company = results[0]?.company;
    const assignments = results.map(r => ({
      assignment: r.assignment,
      user: r.user,
      product: r.product,
    }));

    // Buscar responsável da entrega (usar o assigned_by_id do primeiro assignment)
    let deliveryResponsible = null;
    if (results[0]?.assignment.assigned_by_id) {
      const [responsible] = await db
        .select()
        .from(users)
        .where(eq(users.id, results[0].assignment.assigned_by_id))
        .limit(1);
      deliveryResponsible = responsible ?? null;
    }

    return {
      assignments,
      company: company ?? undefined,
      deliveryResponsible: deliveryResponsible ?? undefined,
    };
  }

  private buildTemplateContext(context: AssignmentContext) {
    const assignment = context.assignment;
    const user = context.user;
    const customer = context.customer;
    const product = context.product;
    const company = context.company;
    const deliveryResponsible = context.deliveryResponsible;

    // Buscar telefone: primeiro de customer, depois de user (se tiver campo phone)
    const userPhone = customer?.phone ?? user?.phone ?? '';

    // Formatar CPF se existir
    const formatCpf = (cpf: string | null | undefined): string => {
      if (!cpf) return '--';
      // Remove formatação e adiciona de volta
      const cleanCpf = cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;
      }
      return cpf;
    };

    // Formatar CNPJ se existir
    const formatCnpj = (cnpj: string | null | undefined): string => {
      if (!cnpj) return '';
      const cleanCnpj = cnpj.replace(/\D/g, '');
      if (cleanCnpj.length === 14) {
        return `${cleanCnpj.slice(0, 2)}.${cleanCnpj.slice(2, 5)}.${cleanCnpj.slice(5, 8)}/${cleanCnpj.slice(8, 12)}-${cleanCnpj.slice(12)}`;
      }
      return cnpj;
    };

    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = today.toLocaleDateString('pt-BR', { month: 'long' });
    const year = today.getFullYear();

    return {
      assignmentId: assignment.id,
      assignedDate: assignment.assigned_date?.toLocaleDateString('pt-BR') ?? '',
      expectedReturnDate: assignment.expected_return_date
        ? new Date(assignment.expected_return_date).toLocaleDateString('pt-BR')
        : 'Não informado',
      userName: user?.name ?? 'Responsável',
      userEmail: user?.email ?? '',
      userCpf: formatCpf(user?.cpf),
      userPhone: userPhone || '--',
      productName: product?.name ?? '',
      productBrand: product?.brand ?? '',
      productModel: product?.model ?? '',
      productSerial: product?.serial_number ?? '',
      productAsset: product?.asset_number ?? '',
      companyName: company?.name ?? 'Empresa',
      companyDocument: formatCnpj(company?.cnpj),
      companyCity: company?.city ?? 'Rio de Janeiro',
      today: today.toLocaleDateString('pt-BR'),
      todayDay: day,
      todayMonth: month,
      todayYear: year.toString(),
      deliveryResponsibleName: deliveryResponsible?.name ?? 'Responsável da Entrega',
      productsCount: '1',
      productsList: this.formatProductList([{ product, assignment }]),
      productsTable: this.formatProductTable([{ product, assignment }]),
    };
  }

  private async buildBatchTemplateContext(context: BatchAssignmentContext) {
    const firstAssignment = context.assignments[0];
    const user = firstAssignment?.user;
    const company = context.company;
    const deliveryResponsible = context.deliveryResponsible;

    // Buscar customer para telefone
    let userPhone = '';
    if (user?.id) {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.user_id, user.id))
        .limit(1);
      userPhone = customer?.phone ?? '';
    }

    // Formatar CPF se existir
    const formatCpf = (cpf: string | null | undefined): string => {
      if (!cpf) return '--';
      const cleanCpf = cpf.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        return `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9)}`;
      }
      return cpf;
    };

    // Formatar CNPJ se existir
    const formatCnpj = (cnpj: string | null | undefined): string => {
      if (!cnpj) return '';
      const cleanCnpj = cnpj.replace(/\D/g, '');
      if (cleanCnpj.length === 14) {
        return `${cleanCnpj.slice(0, 2)}.${cleanCnpj.slice(2, 5)}.${cleanCnpj.slice(5, 8)}/${cleanCnpj.slice(8, 12)}-${cleanCnpj.slice(12)}`;
      }
      return cnpj;
    };

    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = today.toLocaleDateString('pt-BR', { month: 'long' });
    const year = today.getFullYear();

    return {
      assignmentId: firstAssignment?.assignment.id ?? 0,
      assignedDate: firstAssignment?.assignment.assigned_date?.toLocaleDateString('pt-BR') ?? '',
      expectedReturnDate: firstAssignment?.assignment.expected_return_date
        ? new Date(firstAssignment.assignment.expected_return_date).toLocaleDateString('pt-BR')
        : 'Não informado',
      userName: user?.name ?? 'Responsável',
      userEmail: user?.email ?? '',
      userCpf: formatCpf(user?.cpf),
      userPhone: userPhone || '--',
      productName: 'Múltiplos Equipamentos',
      productBrand: '',
      productModel: '',
      productSerial: '',
      productAsset: '',
      companyName: company?.name ?? 'Empresa',
      companyDocument: formatCnpj(company?.cnpj),
      companyCity: company?.city ?? 'Rio de Janeiro',
      today: today.toLocaleDateString('pt-BR'),
      todayDay: day,
      todayMonth: month,
      todayYear: year.toString(),
      deliveryResponsibleName: deliveryResponsible?.name ?? 'Responsável da Entrega',
      productsCount: context.assignments.length.toString(),
      productsList: this.formatProductList(context.assignments),
      productsTable: this.formatProductTable(context.assignments),
    };
  }

  private formatProductList(assignments: Array<{ product?: typeof inventoryProducts.$inferSelect | null; assignment: typeof userInventoryAssignments.$inferSelect }>): string {
    if (assignments.length === 0) return '';

    const items = assignments.map((item, index) => {
      const product = item.product;
      const name = product?.name ?? 'Produto não identificado';
      const brand = product?.brand ? ` - ${product.brand}` : '';
      const model = product?.model ? ` ${product.model}` : '';
      return `<li>${index + 1}. ${name}${brand}${model}</li>`;
    }).join('\n');

    return `<ul>${items}</ul>`;
  }

  private formatProductTable(assignments: Array<{ product?: typeof inventoryProducts.$inferSelect | null; assignment: typeof userInventoryAssignments.$inferSelect }>): string {
    if (assignments.length === 0) return '';

    const rows = assignments.map((item) => {
      const product = item.product;
      // Formato do modelo: apenas nome do equipamento (pode incluir marca/modelo se necessário)
      let equipmentName = product?.name ?? 'Produto não identificado';
      if (product?.brand || product?.model) {
        const parts = [equipmentName];
        if (product.brand) parts.push(product.brand);
        if (product.model) parts.push(product.model);
        equipmentName = parts.join(' - ');
      }
      const serial = product?.serial_number ?? '-';

      return `
        <tr>
          <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 9pt;">${equipmentName}</td>
          <td style="border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 9pt;">${serial}</td>
        </tr>
      `;
    }).join('\n');

    return `
      <table class="equipment-table" style="width: 100%; border-collapse: collapse; margin: 12px 0; border: 1px solid #000; page-break-inside: avoid;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left; background-color: #f5f5f5; font-weight: bold; font-size: 9pt;">EQUIPAMENTO</th>
            <th style="border: 1px solid #000; padding: 6px 8px; text-align: left; background-color: #f5f5f5; font-weight: bold; font-size: 9pt;">SERIAL NUMBER</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  private renderTemplate(template: string, data: Record<string, any>) {
    let rendered = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      rendered = rendered.replace(regex, String(value ?? ''));
    }
    return rendered;
  }

  private async generatePdf(html: string): Promise<Buffer> {
    // Detectar caminho do executável baseado na plataforma
    let executablePath: string | undefined;

    if (process.platform === 'linux') {
      // Linux: usar caminho do chromium-browser do sistema
      executablePath = '/usr/bin/chromium-browser';
    } else if (process.platform === 'win32') {
      // Windows: tentar encontrar Chrome instalado em caminhos comuns
      const fs = await import('fs');

      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      ];

      // Procurar Chrome instalado
      for (const path of possiblePaths) {
        try {
          if (path && fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        } catch (e) {
          // Ignorar erros e tentar próximo caminho
        }
      }

      // Se não encontrou nenhum, deixar undefined (Puppeteer vai tentar usar o bundled)
      if (!executablePath) {
        executablePath = undefined;
      }
    } else {
      // macOS ou outros: deixar undefined
      executablePath = undefined;
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      await page.close();
      return Buffer.from(buffer);
    } finally {
      await browser.close();
    }
  }

  private async getTerm(termId: number, companyId: number) {
    const [term] = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(and(
        eq(inventoryResponsibilityTerms.id, termId),
        eq(inventoryResponsibilityTerms.company_id, companyId)
      ))
      .limit(1);
    return term ?? null;
  }

  private async sendEmailWithLink(params: {
    to: string;
    name: string;
    downloadUrl: string;
    message?: string;
    companyId: number;
  }) {
    const config = await emailConfigService.getEmailConfig(params.companyId);
    if (!config.enabled) {
      throw new Error('Envio de e-mail não está habilitado para esta empresa.');
    }
    if (config.provider !== 'smtp' || !config.smtp) {
      throw new Error('Somente envio SMTP é suportado para termos de responsabilidade.');
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });

    const html = `
      <p>Olá ${params.name},</p>
      <p>Seguem os dados do termo de responsabilidade. Você pode visualizar o documento através do link abaixo:</p>
      <p><a href="${params.downloadUrl}" target="_blank">Visualizar Termo</a></p>
      ${params.message ? `<p>${params.message}</p>` : ''}
      <p>Atenciosamente,<br/>Equipe de Suporte</p>
    `;

    await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: params.to,
      subject: 'Termo de Responsabilidade - Inventário',
      html,
    });
  }
}

export const responsibilityTermService = new ResponsibilityTermService();
export default responsibilityTermService;


