/**
 * API para gerenciar prioridades flexíveis por departamento
 * Endpoints CRUD com validações completas
 */

import { Request, Response } from 'express';
import { PriorityService } from '../services/priority-service';
import { db } from '../db';
import { 
  departments, 
  companies, 
  departmentPriorities, 
  insertDepartmentPrioritySchema, 
  type InsertDepartmentPriority 
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const priorityService = new PriorityService();

/**
 * GET /api/departments/:departmentId/priorities
 * Lista prioridades de um departamento com fallback automático
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

      const allowedDepartmentIds = userDepartments.map(d => d.department_id).filter(id => id !== null);

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
      accessCompanyId = userCompanyId || null;
    }

    if (!accessCompanyId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da empresa não encontrado' 
      });
    }

    // Buscar prioridades com fallback
    const result = await priorityService.getDepartmentPriorities(
      accessCompanyId || department.company_id || 0, 
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
 * POST /api/departments/:departmentId/priorities
 * Cria nova prioridade personalizada
 */
export async function createDepartmentPriority(req: Request, res: Response) {
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

    if (!userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }

    // Verificar se departamento existe e permissões
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
    
    if (userRole === 'admin') {
      targetCompanyId = department.company_id;
    } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
      if (!userCompanyId || department.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para gerenciar este departamento' 
        });
      }
      targetCompanyId = userCompanyId;
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para criar prioridades' 
      });
    }

    // Validar dados de entrada
    const validationSchema = insertDepartmentPrioritySchema.omit({
      company_id: true,
      department_id: true
    });

    const validationResult = validationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dados inválidos', 
        errors: validationResult.error.issues 
      });
    }

    const { name, weight, color } = validationResult.data;

    // Preparar dados para criação
    const priorityData: InsertDepartmentPriority = {
      company_id: targetCompanyId || 0,
      department_id: departmentId,
      name: name.trim(),
      weight,
      color: color || '#6B7280',
      is_active: true
    };

    // Criar prioridade usando o serviço
    const createdPriority = await priorityService.createCustomPriority(priorityData);

    res.status(201).json({
      success: true,
      message: 'Prioridade criada com sucesso',
      data: createdPriority
    });

  } catch (error) {
    console.error('Erro ao criar prioridade:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao criar prioridade' 
    });
  }
}

/**
 * PUT /api/priorities/:id
 * Atualiza prioridade existente
 */
export async function updatePriority(req: Request, res: Response) {
  try {
    const priorityId = parseInt(req.params.id);
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;

    if (isNaN(priorityId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da prioridade inválido' 
      });
    }

    if (!userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }

    // Para usuários não-admin, userCompanyId é obrigatório
    if (userRole !== 'admin' && !userCompanyId) {
      return res.status(401).json({ 
        success: false, 
        message: 'ID da empresa do usuário não encontrado' 
      });
    }

    // Buscar prioridade diretamente pelo ID
    const existingPriority = await priorityService.getPriorityById(priorityId);

    if (!existingPriority) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prioridade não encontrada' 
      });
    }

    // Verificar permissões usando company_id do registro retornado
    if (userRole === 'admin') {
      // Admin pode editar qualquer prioridade
    } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
      if (existingPriority.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para editar esta prioridade' 
        });
      }
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para editar prioridades' 
      });
    }

    // Validar dados de entrada
    const updateSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório').max(50, 'Nome muito longo').optional(),
      weight: z.number().int().min(1, 'Peso deve ser positivo').optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato #RRGGBB').optional(),
      is_active: z.boolean().optional()
    });

    const validationResult = updateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Dados inválidos', 
        errors: validationResult.error.issues 
      });
    }

    const updateData = validationResult.data;
    
    // Se estiver alterando o nome, fazer trim
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }

    // Atualizar usando o serviço
    const updatedPriority = await priorityService.updatePriority(priorityId, updateData);

    res.json({
      success: true,
      message: 'Prioridade atualizada com sucesso',
      data: updatedPriority
    });

  } catch (error) {
    console.error('Erro ao atualizar prioridade:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao atualizar prioridade' 
    });
  }
}

/**
 * DELETE /api/priorities/:id
 * Remove prioridade (soft delete)
 */
export async function deletePriority(req: Request, res: Response) {
  try {
    const priorityId = parseInt(req.params.id);
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;

    if (isNaN(priorityId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da prioridade inválido' 
      });
    }

    if (!userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }

    // Para usuários não-admin, userCompanyId é obrigatório
    if (userRole !== 'admin' && !userCompanyId) {
      return res.status(401).json({ 
        success: false, 
        message: 'ID da empresa do usuário não encontrado' 
      });
    }

    // Buscar prioridade diretamente pelo ID
    const existingPriority = await priorityService.getPriorityById(priorityId);

    if (!existingPriority) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prioridade não encontrada' 
      });
    }

    // Verificar permissões usando company_id do registro retornado
    if (userRole === 'admin') {
      // Admin pode deletar qualquer prioridade
    } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
      if (existingPriority.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para remover esta prioridade' 
        });
      }
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para remover prioridades' 
      });
    }

    // Remover usando o serviço
    await priorityService.deletePriority(priorityId);

    res.json({
      success: true,
      message: 'Prioridade removida com sucesso'
    });

  } catch (error) {
    console.error('Erro ao remover prioridade:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao remover prioridade' 
    });
  }
}

/**
 * POST /api/departments/:departmentId/priorities/reorder
 * Reordena prioridades de um departamento
 */
export async function reorderPriorities(req: Request, res: Response) {
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

    // Verificar se departamento existe e permissões
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

    if (!userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não autenticado' 
      });
    }

    // Verificar permissões
    let targetCompanyId = department.company_id;
    
    if (userRole === 'admin') {
      targetCompanyId = department.company_id;
    } else if (['company_admin', 'manager', 'supervisor'].includes(userRole)) {
      if (!userCompanyId || department.company_id !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para reordenar prioridades deste departamento' 
        });
      }
      targetCompanyId = userCompanyId;
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para reordenar prioridades' 
      });
    }

      // Validar dados de entrada - permitir IDs negativos para prioridades virtuais
  const reorderSchema = z.object({
    priorities: z.array(z.object({
      id: z.number().int(), // Remover validação .positive() para permitir IDs negativos
      weight: z.number().int().positive()
    })).min(1, 'Lista de prioridades não pode estar vazia')
  });



  const validationResult = reorderSchema.safeParse(req.body);
  if (!validationResult.success) {
    console.log('Erro de validação:', validationResult.error.issues);
    return res.status(400).json({ 
      success: false, 
      message: 'Dados inválidos', 
      errors: validationResult.error.issues 
    });
  }

  const { priorities } = validationResult.data;

  // SEMPRE ativar sistema flexível quando há reordenação (independente se prioridades são virtuais ou reais)
  if (!targetCompanyId) {
    return res.status(400).json({
      success: false,
      message: 'ID da empresa é obrigatório'
    });
  }

  const [company] = await db
    .select({ uses_flexible_sla: companies.uses_flexible_sla })
    .from(companies)
    .where(eq(companies.id, targetCompanyId))
    .limit(1);

  if (!company?.uses_flexible_sla) {
    console.log(`🔄 Ativando sistema flexível para empresa ${targetCompanyId} devido à reordenação`);
    await db
      .update(companies)
      .set({ uses_flexible_sla: true })
      .where(eq(companies.id, targetCompanyId));
    console.log(`✅ Sistema flexível ativado para empresa ${targetCompanyId}`);
  }

  // Verificar se há IDs negativos (prioridades virtuais)
  const hasVirtualPriorities = priorities.some(p => p.id < 0);
  
  if (hasVirtualPriorities) {
    // Verificar se targetCompanyId é válido
    if (!targetCompanyId) {
      return res.status(400).json({
        success: false,
        message: 'ID da empresa é obrigatório'
      });
    }

    // BUSCAR PRIORIDADES REAIS EXISTENTES DIRETAMENTE DO BANCO
    const existingPriorities = await db
      .select()
      .from(departmentPriorities)
      .where(and(
        eq(departmentPriorities.company_id, targetCompanyId),
        eq(departmentPriorities.department_id, departmentId),
        eq(departmentPriorities.is_active, true)
      ))
      .orderBy(departmentPriorities.weight);

    let realPriorities;

    if (existingPriorities.length > 0) {
      // SE JÁ EXISTEM PRIORIDADES REAIS, MAPEAR DIRETAMENTE
      realPriorities = priorities.map(virtualPriority => {
        const realPriority = existingPriorities.find(p => p.weight === virtualPriority.weight);
        if (!realPriority) {
          throw new Error(`Prioridade com peso ${virtualPriority.weight} não encontrada`);
        }
        return {
          id: realPriority.id,
          weight: virtualPriority.weight
        };
      });
    } else {
      // SE NÃO EXISTEM, CRIAR AS PRIORIDADES PADRÃO
      const createdPriorities = await priorityService.createDefaultPrioritiesForDepartment(
        targetCompanyId,
        departmentId
      );
      
      realPriorities = priorities.map(virtualPriority => {
        const realPriority = createdPriorities.find(p => p.weight === virtualPriority.weight);
        if (!realPriority) {
          throw new Error(`Prioridade com peso ${virtualPriority.weight} não encontrada`);
        }
        return {
          id: realPriority.id,
          weight: virtualPriority.weight
        };
      });
    }


    
    // Reordenar usando os IDs reais
    const reorderedPriorities = await priorityService.reorderPriorities(
      targetCompanyId,
      departmentId,
      realPriorities
    );
    
    return res.json({
      success: true,
      message: 'Prioridades reordenadas com sucesso',
      data: reorderedPriorities
    });
  }

  // Reordenar usando o serviço (caso normal - sem prioridades virtuais)
  const reorderedPriorities = await priorityService.reorderPriorities(
    targetCompanyId,
    departmentId,
    priorities
  );

    res.json({
      success: true,
      message: 'Prioridades reordenadas com sucesso',
      data: reorderedPriorities
    });

  } catch (error) {
    console.error('Erro ao reordenar prioridades:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao reordenar prioridades' 
    });
  }
}

/**
 * POST /api/departments/:departmentId/priorities/create-defaults
 * Cria prioridades padrão para um departamento
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

        const allowedDepartmentIds = userDepartments.map(d => d.department_id).filter(id => id !== null);

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

/**
 * POST /api/companies/:companyId/enable-flexible-sla
 * Ativa sistema flexível de SLA para uma empresa
 */
export async function enableFlexibleSLA(req: Request, res: Response) {
  try {
    const companyId = parseInt(req.params.companyId);
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;

    if (isNaN(companyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID da empresa inválido' 
      });
    }

    // Verificar permissões
    if (userRole === 'admin') {
      // Admin pode ativar para qualquer empresa
    } else if (userRole === 'company_admin') {
      if (companyId !== userCompanyId) {
        return res.status(403).json({ 
          success: false, 
          message: 'Sem permissão para ativar sistema flexível nesta empresa' 
        });
      }
    } else {
      return res.status(403).json({ 
        success: false, 
        message: 'Sem permissão para ativar sistema flexível' 
      });
    }

    // Verificar se empresa existe
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: 'Empresa não encontrada' 
      });
    }

    // Ativar sistema flexível usando o serviço
    await priorityService.enableFlexibleSLA(companyId);

    res.json({
      success: true,
      message: 'Sistema flexível de SLA ativado com sucesso',
      data: {
        company_id: companyId,
        uses_flexible_sla: true
      }
    });

  } catch (error) {
    console.error('Erro ao ativar sistema flexível:', error);
    
    if (error instanceof Error) {
      return res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao ativar sistema flexível' 
    });
  }
}

/**
 * GET /api/department-priorities?company_id=X
 * Busca todas as prioridades de uma empresa (para SLA Matrix)
 */
export async function getAllCompanyPriorities(req: Request, res: Response) {
  try {
    const userCompanyId = req.session.companyId;
    const userRole = req.session.userRole;
    
    // Determinar qual empresa buscar
    let targetCompanyId: number;
    
    if (userRole === 'admin') {
      // Admin pode especificar qualquer empresa via query param
      const companyIdParam = req.query.company_id as string | undefined;
      targetCompanyId = companyIdParam 
        ? parseInt(companyIdParam)
        : userCompanyId || 1;
    } else {
      // Outros roles só podem acessar sua própria empresa
      if (!userCompanyId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário não possui empresa associada'
        });
      }
      targetCompanyId = userCompanyId;
    }
    
    if (isNaN(targetCompanyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID da empresa inválido'
      });
    }
    
    // Buscar todas as prioridades da empresa
    const priorities = await db
      .select()
      .from(departmentPriorities)
      .where(and(
        eq(departmentPriorities.company_id, targetCompanyId),
        eq(departmentPriorities.is_active, true)
      ))
      .orderBy(departmentPriorities.department_id, departmentPriorities.weight);
    
    res.json({
      success: true,
      data: priorities
    });
    
  } catch (error) {
    console.error('Erro ao buscar prioridades da empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar prioridades da empresa'
    });
  }
}