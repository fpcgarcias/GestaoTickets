import { Request, Response } from 'express';
import inventoryReportService, { InventoryReportType, ReportFormat } from '../services/inventory-report-service';

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

export async function generateInventoryReport(req: Request, res: Response) {
  try {
    const companyId = resolveCompanyId(req);
    const type = req.query.type as InventoryReportType;
    const format = (req.query.format as ReportFormat) || 'json';

    if (!type) {
      return res.status(400).json({ success: false, message: 'Tipo de relatório é obrigatório' });
    }

    const result = await inventoryReportService.generateReport({
      companyId,
      type,
      format,
      filters: req.query,
    });

    if (format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${type}.xlsx`);
      return res.send(result);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Erro ao gerar relatório de inventário:', error);
    res.status(400).json({ success: false, message: String(error) });
  }
}

