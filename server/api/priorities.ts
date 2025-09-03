/**
 * API para gerenciar prioridades flexíveis
 */

import { Request, Response } from 'express';
import { PriorityService } from '../services/priority-service';
import { db } from '../db';
import { departments } from '@shared/schema';
import { eq } from 'drizzle-orm';

const priorityService = new PriorityService();

/**
 * GET /api/departments/:departmentId/priorities
 */
export async function getDepartmentPriorities(req: Request, res: Response) {
  try {
    const departmentId = parseInt(req.params.departmentId);
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;
    const context = (req.query.context as string) || '';

    if (isNaN(departmentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID do departamento inválido' 
      });
    }

    // Verificar se departamento existe
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Departamento não encontrado' 
      });
    }

    // Verificar permissões
    let accessCompanyId = department.company_id;
    const userId = req.session.userId;
    
    if (!userRole || !userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }

    // Para customers, permitir acesso se for da mesma empresa
    if (userRole === 'customer') {
      // Customers podem acessar qualquer departamento da empresa (para criar tickets)
      accessCompanyId = department.company_id;
    } else {
      // Para outros roles, verificar se tem companyId e se é da mesma empresa
      if (!userCompanyId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuário não tem empresa associada' 
        });
      }

      if (userRole !== 'admin' && department.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para acessar este departamento' 
        });
      }
      
      if (userRole !== 'admin') {
        accessCompanyId = userCompanyId;
      }
    }

    // 🆕 Para support/supervisor: verificar se tem acesso ao departamento específico
    // EXCETO quando estiver no contexto de criação de ticket (context=create_ticket),
    // onde devem visualizar prioridades de qualquer departamento da empresa
    if ((userRole === 'support' || userRole === 'supervisor') && context !== 'create_ticket') {
      const { officials, officialDepartments } = await import('@shared/schema');
      
      // Buscar o official do usuário
      const [official] = await db
        .select()
        .from(officials)
        .where(eq(officials.user_id, userId))
        .limit(1);

      if (!official) {
        return res.status(403).json({ 
          success: false, 
          message: 'Usuário não é um atendente' 
        });
      }

      // Buscar departamentos do usuário
      const userDepartments = await db
        .select({ department_id: officialDepartments.department_id })
        .from(officialDepartments)
        .where(eq(officialDepartments.official_id, official.id));

      let allowedDepartmentIds = userDepartments.map(d => d.department_id).filter(id => id !== null);

      // Se for supervisor, incluir departamentos dos subordinados
      if (userRole === 'supervisor') {
        const subordinates = await db
          .select({ id: officials.id })
          .from(officials)
          .where(eq(officials.supervisor_id, official.id));

        for (const subordinate of subordinates) {
          const subordinateDepartments = await db
            .select({ department_id: officialDepartments.department_id })
            .from(officialDepartments)
            .where(eq(officialDepartments.official_id, subordinate.id));
          
          subordinateDepartments.forEach(dept => {
            if (dept.department_id && !allowedDepartmentIds.includes(dept.department_id)) {
              allowedDepartmentIds.push(dept.department_id);
            }
          });
        }
      }

      // Verificar se o departamento está na lista permitida
      const hasAccess = allowedDepartmentIds.includes(departmentId);
      if (!hasAccess) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para acessar prioridades deste departamento' 
        });
      }
    }

    if (userRole !== 'admin') {
      accessCompanyId = userCompanyId;
    }

    if (!accessCompanyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da empresa não encontrado' 
      });
    }

    // Buscar prioridades com fallback
    const result = await priorityService.getDepartmentPriorities(
      accessCompanyId || department.company_id, 
      departmentId
    );

    res.json({
      success: true,
      data: {
        department: {
          id: department.id,
          name: department.name,
          company_id: department.company_id
        },
        priorities: result.priorities,
        isDefault: result.isDefault,
        source: result.source,
        count: result.priorities.length
      }
    });

  } catch (error) {
    console.error('Erro ao buscar prioridades do departamento:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar prioridades' 
    });
  }
}

/**
 * POST /api/departments/:departmentId/priorities/create-defaults
 */
export async function createDefaultPriorities(req: Request, res: Response) {
  try {
    const departmentId = parseInt(req.params.departmentId);
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;

    if (isNaN(departmentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID do departamento inválido' 
      });
    }

    // Verificar se departamento existe
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);

    if (!department) {
      return res.status(404).json({ 
        success: false, 
        message: 'Departamento não encontrado' 
      });
    }

    // Verificar permissões
    let targetCompanyId = department.company_id;
    const userId = req.session.userId;
    
    if (!userRole || !userCompanyId || !userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }
    
    if (userRole === 'admin') {
      targetCompanyId = department.company_id;
    } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
      if (department.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para criar prioridades neste departamento' 
        });
      }

      // 🆕 Para supervisor: verificar se tem acesso ao departamento específico  
      if (userRole === 'supervisor') {
        const { officials, officialDepartments } = await import('@shared/schema');
        
        // Buscar o official do usuário
        const [official] = await db
          .select()
          .from(officials)
          .where(eq(officials.user_id, userId))
          .limit(1);

        if (!official) {
          return res.status(403).json({ 
            success: false, 
            message: 'Usuário não é um atendente' 
          });
        }

        // Buscar departamentos do usuário
        const userDepartments = await db
          .select()
          .from(officialDepartments)
          .where(eq(officialDepartments.official_id, official.id));

        let allowedDepartmentIds = userDepartments.map(d => d.department_id).filter(id => id !== null);

        // Incluir departamentos dos subordinados
        const subordinates = await db
          .select()
          .from(officials)
          .where(eq(officials.supervisor_id, official.id));

        for (const subordinate of subordinates) {
          const subordinateDepartments = await db
            .select({ department_id: officialDepartments.department_id })
            .from(officialDepartments)
            .where(eq(officialDepartments.official_id, subordinate.id));
          
          subordinateDepartments.forEach(dept => {
            if (dept.department_id && !allowedDepartmentIds.includes(dept.department_id)) {
              allowedDepartmentIds.push(dept.department_id);
            }
          });
        }

        // Verificar se o departamento está na lista permitida
        const hasAccess = allowedDepartmentIds.includes(departmentId);
        if (!hasAccess) {
          return res.status(403).json({ 
            success: false, 
            message: 'Sem permissão para criar prioridades neste departamento' 
          });
        }
      }

      targetCompanyId = userCompanyId;
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para criar prioridades' 
      });
    }

    if (!targetCompanyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da empresa não encontrado' 
      });
    }

    // Criar prioridades padrão
    const createdPriorities = await priorityService.createDefaultPrioritiesForDepartment(
      targetCompanyId,
      departmentId
    );

    res.status(201).json({
      success: true,
      message: 'Prioridades padrão criadas com sucesso',
      data: createdPriorities
    });

  } catch (error) {
    console.error('Erro ao criar prioridades padrão:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao criar prioridades padrão' 
    });
  }
} 