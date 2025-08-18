/**
 * Serviço para gerenciar configurações de SLA
 * CRUD completo com bulk operations e validações de negócio
 */

import { db } from '../db';
import { 
  slaConfigurations,
  departments,
  incidentTypes,
  departmentPriorities,
  companies,
  categories,
  type SlaConfiguration,
  type InsertSlaConfiguration
} from '@shared/schema';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';

// Interfaces para operações
export interface SLAConfigurationInput {
  companyId: number;
  departmentId: number;
  incidentTypeId: number;
  categoryId?: number | null;
  priorityId?: number | null;
  responseTimeHours: number;
  resolutionTimeHours: number;
  isActive?: boolean;
}

export interface SLAConfigurationUpdate {
  responseTimeHours?: number;
  resolutionTimeHours?: number;
  isActive?: boolean;
}

export interface BulkSLAOperation {
  companyId: number;
  departmentId: number;
  configurations: Array<{
    incidentTypeId: number;
    categoryId?: number | null;
    priorityId?: number | null;
    responseTimeHours: number;
    resolutionTimeHours: number;
  }>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export class SLAConfigurationService {
  
  /**
   * Validar dados de configuração SLA
   */
  async validateSLAConfiguration(input: SLAConfigurationInput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validar campos obrigatórios
    if (!input.companyId) {
      errors.push({
        field: 'companyId',
        message: 'ID da empresa é obrigatório',
        code: 'REQUIRED_FIELD'
      });
    }

    if (!input.departmentId) {
      errors.push({
        field: 'departmentId', 
        message: 'ID do departamento é obrigatório',
        code: 'REQUIRED_FIELD'
      });
    }

    if (!input.incidentTypeId) {
      errors.push({
        field: 'incidentTypeId',
        message: 'ID do tipo de incidente é obrigatório', 
        code: 'REQUIRED_FIELD'
      });
    }

    if (!input.responseTimeHours || input.responseTimeHours <= 0) {
      errors.push({
        field: 'responseTimeHours',
        message: 'Tempo de resposta deve ser maior que zero',
        code: 'INVALID_VALUE'
      });
    }

    if (!input.resolutionTimeHours || input.resolutionTimeHours <= 0) {
      errors.push({
        field: 'resolutionTimeHours',
        message: 'Tempo de resolução deve ser maior que zero',
        code: 'INVALID_VALUE'
      });
    }

    // Validar lógica de negócio
    if (input.responseTimeHours && input.resolutionTimeHours) {
      if (input.responseTimeHours >= input.resolutionTimeHours) {
        errors.push({
          field: 'responseTimeHours',
          message: 'Tempo de resposta deve ser menor que tempo de resolução',
          code: 'BUSINESS_RULE_VIOLATION'
        });
      }

      // Warning se tempos são muito baixos
      if (input.responseTimeHours < 1) {
        warnings.push('Tempo de resposta menor que 1 hora pode ser difícil de cumprir');
      }

      if (input.resolutionTimeHours < 2) {
        warnings.push('Tempo de resolução menor que 2 horas pode ser difícil de cumprir');
      }
    }

    // Validar se entidades existem
    let deptSlaMode: 'type' | 'category' | undefined;
    if (input.companyId && input.departmentId) {
      const department = await db
        .select({ id: departments.id, company_id: departments.company_id, sla_mode: departments.sla_mode })
        .from(departments)
        .where(and(
          eq(departments.id, input.departmentId),
          eq(departments.company_id, input.companyId)
        ))
        .limit(1);

      if (department.length === 0) {
        errors.push({
          field: 'departmentId',
          message: 'Departamento não encontrado ou não pertence à empresa',
          code: 'ENTITY_NOT_FOUND'
        });
      } else {
        deptSlaMode = (department[0].sla_mode as any) || 'type';
      }
    }

    if (input.incidentTypeId) {
      const incidentType = await db
        .select()
        .from(incidentTypes)
        .where(eq(incidentTypes.id, input.incidentTypeId))
        .limit(1);

      if (incidentType.length === 0) {
        errors.push({
          field: 'incidentTypeId',
          message: 'Tipo de incidente não encontrado',
          code: 'ENTITY_NOT_FOUND'
        });
      }
    }

    // Regras por modo de SLA (por departamento)
    if (deptSlaMode === 'category') {
      // categoryId é obrigatório
      if (input.categoryId === undefined || input.categoryId === null) {
        errors.push({
          field: 'categoryId',
          message: 'Categoria é obrigatória quando o departamento usa SLA por categoria',
          code: 'REQUIRED_FIELD'
        });
      } else {
        // Validar existência da categoria e relação com incidentType
        const category = await db
          .select()
          .from(categories)
          .where(and(
            eq(categories.id, input.categoryId),
            eq(categories.incident_type_id, input.incidentTypeId)
          ))
          .limit(1);
        if (category.length === 0) {
          errors.push({
            field: 'categoryId',
            message: 'Categoria não encontrada ou não pertence ao tipo de incidente informado',
            code: 'ENTITY_NOT_FOUND'
          });
        }
      }
    } else if (deptSlaMode === 'type') {
      // categoryId deve ser NULL
      if (input.categoryId !== undefined && input.categoryId !== null) {
        errors.push({
          field: 'categoryId',
          message: 'Categoria deve ser vazia quando o departamento usa SLA por tipo',
          code: 'INVALID_VALUE'
        });
      }
    }

    if (input.priorityId) {
      const priority = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.id, input.priorityId),
          eq(departmentPriorities.company_id, input.companyId),
          eq(departmentPriorities.department_id, input.departmentId)
        ))
        .limit(1);

      if (priority.length === 0) {
        errors.push({
          field: 'priorityId',
          message: 'Prioridade não encontrada para este departamento',
          code: 'ENTITY_NOT_FOUND'
        });
      }
    }

    // Verificar duplicatas
    const conditions = [
      eq(slaConfigurations.company_id, input.companyId),
      eq(slaConfigurations.department_id, input.departmentId),
      eq(slaConfigurations.incident_type_id, input.incidentTypeId)
    ];

    // Incluir category na verificação de duplicidade (alinha com índices únicos parciais)
    if (input.categoryId === null || input.categoryId === undefined) {
      conditions.push(isNull(slaConfigurations.category_id));
    } else {
      conditions.push(eq(slaConfigurations.category_id, input.categoryId));
    }

    if (input.priorityId) {
      conditions.push(eq(slaConfigurations.priority_id, input.priorityId));
    } else {
      conditions.push(isNull(slaConfigurations.priority_id));
    }

    const existing = await db
      .select()
      .from(slaConfigurations)
      .where(and(...conditions))
      .limit(1);

    if (existing.length > 0) {
      errors.push({
        field: 'configuration',
        message: 'Já existe uma configuração para esta combinação',
        code: 'DUPLICATE_CONFIGURATION'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Criar nova configuração SLA
   */
  async createSLAConfiguration(input: SLAConfigurationInput): Promise<SlaConfiguration> {
    // Validar entrada
    const validation = await this.validateSLAConfiguration(input);
    if (!validation.isValid) {
      throw new Error(`Validação falhou: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    const newConfig: InsertSlaConfiguration = {
      company_id: input.companyId,
      department_id: input.departmentId,
      incident_type_id: input.incidentTypeId,
      category_id: input.categoryId ?? null,
      priority_id: input.priorityId || null,
      response_time_hours: input.responseTimeHours,
      resolution_time_hours: input.resolutionTimeHours,
      is_active: input.isActive !== false
    };

    const [created] = await db
      .insert(slaConfigurations)
      .values(newConfig)
      .returning();

    return created;
  }

  /**
   * Buscar configurações SLA com filtros
   */
  async getSLAConfigurations(filters: {
    companyId?: number;
    departmentId?: number;
    incidentTypeId?: number;
    categoryId?: number | null;
    priorityId?: number;
    isActive?: boolean;
  } = {}): Promise<SlaConfiguration[]> {
    const conditions: any[] = [];

    if (filters.companyId) {
      conditions.push(eq(slaConfigurations.company_id, filters.companyId));
    }

    if (filters.departmentId) {
      conditions.push(eq(slaConfigurations.department_id, filters.departmentId));
    }

    if (filters.incidentTypeId) {
      conditions.push(eq(slaConfigurations.incident_type_id, filters.incidentTypeId));
    }

    if (filters.categoryId !== undefined) {
      if (filters.categoryId === null) {
        conditions.push(isNull(slaConfigurations.category_id));
      } else {
        conditions.push(eq(slaConfigurations.category_id, filters.categoryId));
      }
    }

    if (filters.priorityId !== undefined) {
      if (filters.priorityId === null) {
        conditions.push(isNull(slaConfigurations.priority_id));
      } else {
        conditions.push(eq(slaConfigurations.priority_id, filters.priorityId));
      }
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(slaConfigurations.is_active, filters.isActive));
    }

    const query = conditions.length > 0 ? 
      db.select().from(slaConfigurations).where(and(...conditions)) :
      db.select().from(slaConfigurations);

    return await query.orderBy(
      slaConfigurations.company_id,
      slaConfigurations.department_id,
      slaConfigurations.incident_type_id
    );
  }

  /**
   * Buscar configuração SLA por ID
   */
  async getSLAConfigurationById(id: number): Promise<SlaConfiguration | null> {
    const [config] = await db
      .select()
      .from(slaConfigurations)
      .where(eq(slaConfigurations.id, id))
      .limit(1);

    return config || null;
  }

  /**
   * Atualizar configuração SLA
   */
  async updateSLAConfiguration(id: number, updates: SLAConfigurationUpdate): Promise<SlaConfiguration> {
    // Buscar configuração existente
    const existing = await this.getSLAConfigurationById(id);
    if (!existing) {
      throw new Error('Configuração SLA não encontrada');
    }

    // Validar atualizações
    if (updates.responseTimeHours !== undefined) {
      if (updates.responseTimeHours <= 0) {
        throw new Error('Tempo de resposta deve ser maior que zero');
      }
    }

    if (updates.resolutionTimeHours !== undefined) {
      if (updates.resolutionTimeHours <= 0) {
        throw new Error('Tempo de resolução deve ser maior que zero');
      }
    }

    // Validar regra de negócio
    const newResponseTime = updates.responseTimeHours !== undefined ? 
      updates.responseTimeHours : existing.response_time_hours;
    const newResolutionTime = updates.resolutionTimeHours !== undefined ? 
      updates.resolutionTimeHours : existing.resolution_time_hours;

    if (newResponseTime >= newResolutionTime) {
      throw new Error('Tempo de resposta deve ser menor que tempo de resolução');
    }

    // Mapear campos do camelCase para snake_case do banco
    const updateData: any = {
      updated_at: new Date()
    };

    if (updates.responseTimeHours !== undefined) {
      updateData.response_time_hours = updates.responseTimeHours;
    }

    if (updates.resolutionTimeHours !== undefined) {
      updateData.resolution_time_hours = updates.resolutionTimeHours;
    }

    if (updates.isActive !== undefined) {
      updateData.is_active = updates.isActive;
    }

    const [updated] = await db
      .update(slaConfigurations)
      .set(updateData)
      .where(eq(slaConfigurations.id, id))
      .returning();

    return updated;
  }

  /**
   * Deletar configuração SLA
   */
  async deleteSLAConfiguration(id: number): Promise<boolean> {
    const result = await db
      .delete(slaConfigurations)
      .where(eq(slaConfigurations.id, id));

    return (result.rowCount || 0) > 0;
  }

  /**
   * Bulk operation: Criar múltiplas configurações
   */
  async bulkCreateSLAConfigurations(operation: BulkSLAOperation): Promise<{
    created: SlaConfiguration[];
    errors: Array<{ configuration: any; error: string }>;
  }> {
    const created: SlaConfiguration[] = [];
    const errors: Array<{ configuration: any; error: string }> = [];

    for (const config of operation.configurations) {
      try {
        const input: SLAConfigurationInput = {
          companyId: operation.companyId,
          departmentId: operation.departmentId,
          incidentTypeId: config.incidentTypeId,
          categoryId: config.categoryId ?? null,
          priorityId: config.priorityId,
          responseTimeHours: config.responseTimeHours,
          resolutionTimeHours: config.resolutionTimeHours
        };

        const newConfig = await this.createSLAConfiguration(input);
        created.push(newConfig);
      } catch (error) {
        errors.push({
          configuration: config,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    return { created, errors };
  }

  /**
   * Bulk operation: Atualizar múltiplas configurações
   */
  async bulkUpdateSLAConfigurations(
    companyId: number,
    departmentId: number,
    updates: SLAConfigurationUpdate
  ): Promise<SlaConfiguration[]> {
    const [updatedConfigs] = await db
      .update(slaConfigurations)
      .set({
        ...updates,
        updated_at: new Date()
      })
      .where(and(
        eq(slaConfigurations.company_id, companyId),
        eq(slaConfigurations.department_id, departmentId)
      ))
      .returning();

    return Array.isArray(updatedConfigs) ? updatedConfigs : [updatedConfigs];
  }

  /**
   * Bulk operation: Deletar múltiplas configurações
   */
  async bulkDeleteSLAConfigurations(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await db
      .delete(slaConfigurations)
      .where(inArray(slaConfigurations.id, ids));

    return result.rowCount || 0;
  }

  /**
   * Ativar/Desativar múltiplas configurações
   */
  async bulkToggleActive(ids: number[], isActive: boolean): Promise<SlaConfiguration[]> {
    if (ids.length === 0) return [];

    const [updated] = await db
      .update(slaConfigurations)
      .set({
        is_active: isActive,
        updated_at: new Date()
      })
      .where(inArray(slaConfigurations.id, ids))
      .returning();

    return Array.isArray(updated) ? updated : [updated];
  }

  /**
   * Copiar configurações de um departamento para outro
   */
  async copySLAConfigurations(
    fromDepartmentId: number,
    toDepartmentId: number,
    companyId: number,
    overwriteExisting = false
  ): Promise<{
    copied: SlaConfiguration[];
    skipped: number;
    errors: string[];
  }> {
    // Buscar configurações origem
    const sourceConfigs = await this.getSLAConfigurations({
      companyId,
      departmentId: fromDepartmentId,
      isActive: true
    });

    if (sourceConfigs.length === 0) {
      throw new Error('Nenhuma configuração encontrada no departamento origem');
    }

    const copied: SlaConfiguration[] = [];
    let skipped = 0;
    const errors: string[] = [];

    for (const sourceConfig of sourceConfigs) {
      try {
        // Verificar se já existe configuração no destino
        const conditions = [
          eq(slaConfigurations.company_id, companyId),
          eq(slaConfigurations.department_id, toDepartmentId),
          eq(slaConfigurations.incident_type_id, sourceConfig.incident_type_id)
        ];

        if (sourceConfig.priority_id) {
          conditions.push(eq(slaConfigurations.priority_id, sourceConfig.priority_id));
        } else {
          conditions.push(isNull(slaConfigurations.priority_id));
        }

        const existing = await db
          .select()
          .from(slaConfigurations)
          .where(and(...conditions))
          .limit(1);

        if (existing.length > 0 && !overwriteExisting) {
          skipped++;
          continue;
        }

        // Se existe e deve sobrescrever, deletar primeiro
        if (existing.length > 0 && overwriteExisting) {
          await db
            .delete(slaConfigurations)
            .where(eq(slaConfigurations.id, existing[0].id));
        }

        // Criar nova configuração
        const newConfig: InsertSlaConfiguration = {
          company_id: companyId,
          department_id: toDepartmentId,
          incident_type_id: sourceConfig.incident_type_id,
          priority_id: sourceConfig.priority_id,
          response_time_hours: sourceConfig.response_time_hours,
          resolution_time_hours: sourceConfig.resolution_time_hours,
          is_active: sourceConfig.is_active
        };

        const [created] = await db
          .insert(slaConfigurations)
          .values(newConfig)
          .returning();

        copied.push(created);

      } catch (error) {
        errors.push(`Erro ao copiar configuração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    return { copied, skipped, errors };
  }
}

// Exportar instância singleton
export const slaConfigurationService = new SLAConfigurationService(); 