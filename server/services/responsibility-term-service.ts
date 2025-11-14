import { db } from '../db';
import {
  inventoryTermTemplates,
  inventoryResponsibilityTerms,
  userInventoryAssignments,
  users,
  inventoryProducts,
  companies,
  type InventoryTermTemplate,
  type InsertInventoryTermTemplate,
  type InventoryResponsibilityTerm,
} from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import s3Service from './s3-service';
import { emailConfigService } from './email-config-service';

export interface TemplateInput extends Omit<InsertInventoryTermTemplate, 'company_id' | 'created_at' | 'updated_at'> {
  company_id: number;
  created_by_id?: number | null;
}

export interface GenerateTermParams {
  assignmentId: number;
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
  product?: typeof inventoryProducts.$inferSelect | null;
  company?: typeof companies.$inferSelect | null;
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

  async generateTerm(params: GenerateTermParams): Promise<InventoryResponsibilityTerm> {
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

    const [term] = await db.insert(inventoryResponsibilityTerms).values({
      assignment_id: params.assignmentId,
      template_id: template.id,
      template_version: template.version,
      pdf_s3_key: uploadResult.s3Key,
      generated_pdf_url: uploadResult.s3Key,
      status: 'pending',
      company_id: params.companyId,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning();

    return term;
  }

  async sendTerm(params: SendTermParams): Promise<{ success: boolean }> {
    const term = await this.getTerm(params.termId, params.companyId);
    if (!term) {
      throw new Error('Termo não encontrado.');
    }

    const assignment = await this.getAssignmentContext(term.assignment_id, params.companyId);
    if (!assignment) {
      throw new Error('Alocação não encontrada para o termo.');
    }

    if (!term.pdf_s3_key) {
      throw new Error('PDF não disponível para este termo.');
    }

    const downloadUrl = await s3Service.getDownloadUrl(term.pdf_s3_key);
    await this.sendEmailWithLink({
      to: params.recipientEmail,
      name: params.recipientName ?? assignment.user?.name ?? 'Responsável',
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
    if (!term || !term.pdf_s3_key) {
      throw new Error('Termo ou PDF não encontrado.');
    }
    return s3Service.getDownloadUrl(term.pdf_s3_key);
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

    return result ?? null;
  }

  private buildTemplateContext(context: AssignmentContext) {
    const assignment = context.assignment;
    const user = context.user;
    const product = context.product;
    const company = context.company;

    return {
      assignmentId: assignment.id,
      assignedDate: assignment.assigned_date?.toLocaleDateString('pt-BR') ?? '',
      expectedReturnDate: assignment.expected_return_date
        ? new Date(assignment.expected_return_date).toLocaleDateString('pt-BR')
        : 'Não informado',
      userName: user?.name ?? 'Responsável',
      userEmail: user?.email ?? '',
      productName: product?.name ?? '',
      productBrand: product?.brand ?? '',
      productModel: product?.model ?? '',
      productSerial: product?.serial_number ?? '',
      productAsset: product?.asset_number ?? '',
      companyName: company?.name ?? 'Empresa',
      companyDocument: company?.cnpj ?? '',
      today: new Date().toLocaleDateString('pt-BR'),
    };
  }

  private renderTemplate(template: string, data: Record<string, string>) {
    let rendered = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      rendered = rendered.replace(regex, value ?? '');
    }
    return rendered;
  }

  private async generatePdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
      return buffer;
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

