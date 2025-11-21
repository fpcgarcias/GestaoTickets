import { Request, Response } from 'express';
import responsibilityTermService from '../services/responsibility-term-service';
import { db } from '../db';
import { inventoryTermTemplates } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

function resolveCompanyId(req: Request): number {
  const userRole = req.session?.userRole;
  const sessionCompanyId = req.session?.companyId;
  if (userRole === 'admin' && req.query.company_id) {
    return parseInt(req.query.company_id as string, 10);
  }
  if (sessionCompanyId) {
    return sessionCompanyId;
  }
  throw new Error('Empresa não definida na sessão.');
}

export async function listTermTemplates(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const templates = await responsibilityTermService.listTemplates(companyId);
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Erro ao listar templates de termos:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}

export async function createTermTemplate(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const userId = req.session?.userId;

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const { name, description, content, is_default, is_active } = req.body;

    if (!name || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome e conteúdo do template são obrigatórios' 
      });
    }

    const template = await responsibilityTermService.createTemplate({
      name,
      description: description || null,
      content,
      is_default: is_default ?? false,
      is_active: is_active ?? true,
      company_id: companyId,
      created_by_id: userId ?? null,
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Erro ao criar template de termo:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function updateTermTemplate(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const templateId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    const { name, description, content, is_default, is_active } = req.body;

    const template = await responsibilityTermService.updateTemplate(
      templateId,
      companyId,
      {
        name,
        description,
        content,
        is_default,
        is_active,
      }
    );

    res.json({ success: true, data: template });
  } catch (error) {
    console.error('Erro ao atualizar template de termo:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function deleteTermTemplate(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const userRole = req.session?.userRole;
    const templateId = parseInt(req.params.id, 10);

    // Bloquear customers
    if (userRole === 'customer') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado ao inventário' 
      });
    }

    // Verificar se template existe e pertence à empresa
    const [template] = await db
      .select()
      .from(inventoryTermTemplates)
      .where(and(
        eq(inventoryTermTemplates.id, templateId),
        eq(inventoryTermTemplates.company_id, companyId)
      ))
      .limit(1);

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template não encontrado' 
      });
    }

    // Não permitir deletar template padrão
    if (template.is_default) {
      return res.status(400).json({ 
        success: false, 
        message: 'Não é possível deletar o template padrão. Defina outro como padrão primeiro.' 
      });
    }

    await db
      .delete(inventoryTermTemplates)
      .where(eq(inventoryTermTemplates.id, templateId));

    res.json({ success: true, message: 'Template deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar template de termo:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

export async function seedDefaultTermTemplate(req: Request, res: Response) {
  try {
    const userRole = req.session?.userRole;
    
    // Apenas admin, company_admin, manager ou supervisor
    if (!['admin', 'company_admin', 'manager', 'supervisor'].includes(userRole || '')) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado' 
      });
    }

    let targetCompanyId = req.session?.companyId;
    
    // Se for admin e especificou company_id no body, usar ele
    if (req.session?.userRole === 'admin' && req.body?.company_id) {
      targetCompanyId = req.body.company_id;
    }

    if (!targetCompanyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Empresa não especificada' 
      });
    }

    // Verificar se já existe template padrão para esta empresa
    const [existing] = await db
      .select()
      .from(inventoryTermTemplates)
      .where(and(
        eq(inventoryTermTemplates.company_id, targetCompanyId),
        eq(inventoryTermTemplates.is_default, true)
      ))
      .limit(1);

    if (existing) {
      return res.json({ 
        success: true, 
        message: 'Template padrão já existe para esta empresa',
        created: 0,
        skipped: 1,
        template: existing
      });
    }

    // Template padrão baseado no modelo fornecido
    const defaultTemplate = {
      name: 'Termo de Responsabilidade - Padrão',
      description: 'Template padrão para termos de responsabilidade de equipamentos',
      content: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termo de Responsabilidade</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .logo {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .company-name {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 20px;
    }
    
    .title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 30px 0;
      padding: 10px 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    
    .section {
      margin: 20px 0;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 10px;
      text-decoration: underline;
    }
    
    .field {
      margin: 8px 0;
    }
    
    .field-label {
      display: inline-block;
      min-width: 120px;
      font-weight: bold;
    }
    
    .field-value {
      display: inline-block;
      border-bottom: 1px solid #000;
      min-width: 300px;
      padding: 0 5px;
    }
    
    .text-content {
      text-align: justify;
      margin: 20px 0;
      line-height: 1.8;
    }
    
    .clause {
      margin: 15px 0;
      text-align: justify;
    }
    
    .clause-number {
      font-weight: bold;
    }
    
    .equipment-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      border: 1px solid #000;
    }
    
    .equipment-table th,
    .equipment-table td {
      border: 1px solid #000;
      padding: 10px;
      text-align: left;
    }
    
    .equipment-table th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    
    .signature-section {
      margin-top: 50px;
      display: flex;
      justify-content: space-between;
    }
    
    .signature-box {
      width: 45%;
      text-align: center;
    }
    
    .signature-line {
      border-top: 1px solid #000;
      margin: 60px auto 10px;
      width: 80%;
    }
    
    .signature-label {
      font-size: 10pt;
      margin-top: 5px;
    }
    
    .date-location {
      margin: 30px 0;
      text-align: left;
    }
    
    .date-location .field-value {
      min-width: 50px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">X</div>
    <div class="company-name">{{companyName}}</div>
  </div>
  
  <div class="title">
    TERMO DE RESPONSABILIDADE PELA GUARDA E USO DO EQUIPAMENTO DE TRABALHO
  </div>
  
  <div class="section">
    <div class="section-title">IDENTIFICAÇÃO DO EMPREGADO</div>
    
    <div class="field">
      <span class="field-label">Nome:</span>
      <span class="field-value">{{userName}}</span>
    </div>
    
    <div class="field">
      <span class="field-label">CPF:</span>
      <span class="field-value">{{userCpf}}</span>
    </div>
    
    <div class="field">
      <span class="field-label">Fone para contato:</span>
      <span class="field-value">{{userPhone}}</span>
    </div>
    
    <div class="field">
      <span class="field-label">e-mail:</span>
      <span class="field-value">{{userEmail}}</span>
    </div>
  </div>
  
  <div class="text-content">
    <p>
      Recebi da empresa <strong>{{companyName}}</strong>, CNPJ nº <strong>{{companyDocument}}</strong>, a título de empréstimo, para meu uso exclusivo, conforme determinado na lei, os equipamentos especificados neste termo de responsabilidade, comprometendo-me a mantê-los em perfeito estado de conservação, ficando ciente de que:
    </p>
  </div>
  
  <div class="clause">
    <span class="clause-number">1-</span>
    Em caso de dano, mau uso, negligência ou perda dos equipamentos, a empresa fornecerá equipamento novo e cobrará o valor de um equipamento equivalente.
  </div>
  
  <div class="clause">
    <span class="clause-number">2-</span>
    Devo comunicar imediatamente ao setor competente em caso de dano, inutilização ou perda dos equipamentos.
  </div>
  
  <div class="clause">
    <span class="clause-number">3-</span>
    Devo devolver os equipamentos completos e em perfeito estado de conservação quando encerrar meus serviços ou quando o contrato de trabalho for rescindido.
  </div>
  
  <div class="clause">
    <span class="clause-number">4-</span>
    Estou sujeito a inspeções sem aviso prévio enquanto os equipamentos estiverem em minha posse.
  </div>
  
  <div class="section">
    {{productsTable}}
  </div>
  
  <div class="date-location">
    <span>{{companyCity}}, <span class="field-value">{{todayDay}}</span> de <span class="field-value">{{todayMonth}}</span> de <span class="field-value">{{todayYear}}</span>.</span>
  </div>
  
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Funcionário(a)</div>
    </div>
    
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Responsável da entrega.</div>
    </div>
  </div>
</body>
</html>`,
      is_default: true,
      is_active: true,
      company_id: targetCompanyId,
      created_by_id: req.session?.userId ?? null,
    };

    const template = await responsibilityTermService.createTemplate(defaultTemplate);

    res.json({ 
      success: true, 
      message: 'Template padrão criado com sucesso',
      created: 1,
      skipped: 0,
      data: template
    });
  } catch (error) {
    console.error('Erro ao criar template padrão de termo:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
}


