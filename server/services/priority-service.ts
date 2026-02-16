/**
 * Serviço para gerenciar prioridades flexíveis por departamento
 * Implementa lógica de fallback e integração com o banco de dados
 */

import { db } from '../db';
import { 
  departmentPriorities, 
  departments, 
  companies,
  type DepartmentPriority, 
  type InsertDepartmentPriority
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  getDepartmentPriorities,
  usesFlexibleSLA,
  createDefaultPriorities,
  validatePriorityWeights,
  type PriorityResult
} from '@shared/utils/priority-utils';
import { logger } from './logger';

export class PriorityService {
  
  /**
   * Busca todas as prioridades de uma empresa (para cache/performance)
   */
  async getAllCompanyPriorities(companyId: number): Promise<DepartmentPriority[]> {
    try {
      logger.debug('getAllCompanyPriorities', { companyId });
      
      const priorities = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.company_id, companyId),
          eq(departmentPriorities.is_active, true)
        ))
        .orderBy(departmentPriorities.department_id, departmentPriorities.weight);

      logger.debug('getAllCompanyPriorities result', { 
        companyId, 
        count: priorities.length,
        priorities: priorities.map(p => ({ id: p.id, dept: p.department_id, weight: p.weight, name: p.name, active: p.is_active }))
      });

      return priorities;
    } catch (error) {
      logger.error('Erro ao buscar prioridades da empresa', { companyId, error });
      throw new Error('Falha ao buscar prioridades da empresa', { cause: error });
    }
  }

  /**
   * Busca uma prioridade específica pelo ID
   * Usado para operações de update/delete que precisam verificar permissões
   */
  async getPriorityById(id: number): Promise<DepartmentPriority | null> {
    try {
      const [priority] = await db
        .select()
        .from(departmentPriorities)
        .where(eq(departmentPriorities.id, id))
        .limit(1);

      return priority || null;
    } catch (error) {
      logger.error('Erro ao buscar prioridade por ID', { id, error });
      throw new Error('Falha ao buscar prioridade', { cause: error });
    }
  }

  /**
   * Busca prioridades de um departamento específico com fallback
   */
  async getDepartmentPriorities(
    companyId: number, 
    departmentId: number
  ): Promise<PriorityResult> {
    try {
      logger.debug('getDepartmentPriorities', { companyId, departmentId });
      
      // Buscar empresa para verificar se usa sistema flexível
      const [company] = await db
        .select({ uses_flexible_sla: companies.uses_flexible_sla })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      logger.debug('Company flexible SLA status', { companyId, usesFlexibleSla: company?.uses_flexible_sla });

      // Se empresa não usa sistema flexível, retornar prioridades padrão
      if (!usesFlexibleSLA(company)) {
        logger.debug('Using legacy system', { companyId });
        return await this.getLegacyPriorities(companyId, departmentId);
      }

      // Buscar todas as prioridades da empresa para eficiência
      const allPriorities = await this.getAllCompanyPriorities(companyId);
      logger.debug('All company priorities fetched', { 
        companyId, 
        count: allPriorities.length,
        priorities: allPriorities.map(p => ({ id: p.id, dept: p.department_id, weight: p.weight, name: p.name }))
      });
      
      // Usar utilitário para determinar prioridades com fallback
      const result = getDepartmentPriorities(companyId, departmentId, allPriorities);
      logger.debug('getDepartmentPriorities result', { 
        companyId, 
        departmentId,
        isDefault: result.isDefault, 
        source: result.source, 
        count: result.priorities.length,
        priorities: result.priorities.map(p => ({ id: p.id, weight: p.weight, name: p.name }))
      });
      
      return result;
      
    } catch (error) {
      logger.error('Erro ao buscar prioridades do departamento', { companyId, departmentId, error });
      throw new Error('Falha ao buscar prioridades do departamento', { cause: error });
    }
  }

  /**
   * Retorna prioridades do sistema legado (para empresas que não migraram)
   * PRIMEIRO verifica se já existem prioridades reais no banco
   */
  private async getLegacyPriorities(companyId: number, departmentId: number): Promise<PriorityResult> {
    // PRIMEIRO: verificar se já existem prioridades reais
    const existingPriorities = await db
      .select()
      .from(departmentPriorities)
      .where(and(
        eq(departmentPriorities.company_id, companyId),
        eq(departmentPriorities.department_id, departmentId),
        eq(departmentPriorities.is_active, true)
      ))
      .orderBy(departmentPriorities.weight);

    // Se existem prioridades reais, retornar elas
    if (existingPriorities.length > 0) {
      logger.debug('Found real priorities for legacy system', { 
        companyId, 
        departmentId, 
        count: existingPriorities.length 
      });
      return {
        priorities: existingPriorities,
        isDefault: false,
        source: 'custom'
      };
    }

    // Se não existem prioridades reais, retornar lista VAZIA
    // Isso permite que o frontend mostre apenas o botão "Criar Padrão"
    logger.debug('No real priorities found, returning empty list', { companyId, departmentId });
    return {
      priorities: [],
      isDefault: true,
      source: 'none'
    };
  }

  /**
   * Cria prioridades padrão para um departamento
   */
  async createDefaultPrioritiesForDepartment(
    companyId: number,
    departmentId: number
  ): Promise<DepartmentPriority[]> {
    try {
      // Verificar se já existem prioridades
      const existing = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.company_id, companyId),
          eq(departmentPriorities.department_id, departmentId)
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('Departamento já possui prioridades configuradas');
      }

      // Criar prioridades padrão
      const defaultPriorities = createDefaultPriorities(companyId, departmentId);
      
      const createdPriorities = await db
        .insert(departmentPriorities)
        .values(defaultPriorities)
        .returning();

      return createdPriorities;
      
    } catch (error) {
      logger.error('Erro ao criar prioridades padrão', { companyId, departmentId, error });
      throw new Error('Falha ao criar prioridades padrão', { cause: error });
    }
  }

  /**
   * Cria uma nova prioridade personalizada
   */
  async createCustomPriority(
    priorityData: InsertDepartmentPriority
  ): Promise<DepartmentPriority> {
    try {
      // Validar se o departamento existe
      const [department] = await db
        .select()
        .from(departments)
        .where(and(
          eq(departments.id, priorityData.department_id),
          eq(departments.company_id, priorityData.company_id)
        ))
        .limit(1);

      if (!department) {
        throw new Error('Departamento não encontrado');
      }

      // Verificar se peso já existe
      const [existingWeight] = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.company_id, priorityData.company_id),
          eq(departmentPriorities.department_id, priorityData.department_id),
          eq(departmentPriorities.weight, priorityData.weight)
        ))
        .limit(1);

      if (existingWeight) {
        throw new Error('Já existe uma prioridade com este peso');
      }

      // Verificar se nome já existe
      const [existingName] = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.company_id, priorityData.company_id),
          eq(departmentPriorities.department_id, priorityData.department_id),
          eq(departmentPriorities.name, priorityData.name)
        ))
        .limit(1);

      if (existingName) {
        throw new Error('Já existe uma prioridade com este nome');
      }

      // Criar prioridade
      const [createdPriority] = await db
        .insert(departmentPriorities)
        .values(priorityData)
        .returning();

      return createdPriority;
      
    } catch (error) {
      logger.error('Erro ao criar prioridade personalizada', { priorityData, error });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Falha ao criar prioridade personalizada', { cause: error });
    }
  }

  /**
   * Atualiza uma prioridade existente
   */
  async updatePriority(
    priorityId: number,
    updateData: Partial<InsertDepartmentPriority>
  ): Promise<DepartmentPriority> {
    try {
      // Buscar prioridade existente
      const [existingPriority] = await db
        .select()
        .from(departmentPriorities)
        .where(eq(departmentPriorities.id, priorityId))
        .limit(1);

      if (!existingPriority) {
        throw new Error('Prioridade não encontrada');
      }

      // Validações se estiver alterando peso ou nome
      if (updateData.weight && updateData.weight !== existingPriority.weight) {
        const [existingWeight] = await db
          .select()
          .from(departmentPriorities)
          .where(and(
            eq(departmentPriorities.company_id, existingPriority.company_id),
            eq(departmentPriorities.department_id, existingPriority.department_id),
            eq(departmentPriorities.weight, updateData.weight)
          ))
          .limit(1);

        if (existingWeight) {
          throw new Error('Já existe uma prioridade com este peso');
        }
      }

      if (updateData.name && updateData.name !== existingPriority.name) {
        const [existingName] = await db
          .select()
          .from(departmentPriorities)
          .where(and(
            eq(departmentPriorities.company_id, existingPriority.company_id),
            eq(departmentPriorities.department_id, existingPriority.department_id),
            eq(departmentPriorities.name, updateData.name)
          ))
          .limit(1);

        if (existingName) {
          throw new Error('Já existe uma prioridade com este nome');
        }
      }

      // Atualizar prioridade
      const [updatedPriority] = await db
        .update(departmentPriorities)
        .set({
          ...updateData,
          updated_at: new Date()
        })
        .where(eq(departmentPriorities.id, priorityId))
        .returning();

      return updatedPriority;
      
    } catch (error) {
      logger.error('Erro ao atualizar prioridade', { priorityId, updateData, error });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Falha ao atualizar prioridade', { cause: error });
    }
  }

  /**
   * Remove uma prioridade (soft delete)
   */
  async deletePriority(priorityId: number): Promise<void> {
    try {
      // Verificar se prioridade existe
      const [existingPriority] = await db
        .select()
        .from(departmentPriorities)
        .where(eq(departmentPriorities.id, priorityId))
        .limit(1);

      if (!existingPriority) {
        throw new Error('Prioridade não encontrada');
      }

      // TODO: Verificar se prioridade está sendo usada em tickets ou configurações de SLA
      // antes de permitir remoção

      // Soft delete
      await db
        .update(departmentPriorities)
        .set({
          is_active: false,
          updated_at: new Date()
        })
        .where(eq(departmentPriorities.id, priorityId));
        
    } catch (error) {
      logger.error('Erro ao remover prioridade', { priorityId, error });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Falha ao remover prioridade', { cause: error });
    }
  }

  /**
   * Reordena prioridades de um departamento
   * Usa estratégia de duas etapas para evitar conflito de constraint única
   */
  async reorderPriorities(
    companyId: number,
    departmentId: number,
    priorityOrders: Array<{ id: number; weight: number }>
  ): Promise<DepartmentPriority[]> {
    try {
      // Validar se todas as prioridades pertencem ao departamento
      const existingPriorities = await db
        .select()
        .from(departmentPriorities)
        .where(and(
          eq(departmentPriorities.company_id, companyId),
          eq(departmentPriorities.department_id, departmentId),
          eq(departmentPriorities.is_active, true)
        ));

      const existingIds = existingPriorities.map(p => p.id);
      const providedIds = priorityOrders.map(p => p.id);

      if (providedIds.some((id: number) => !existingIds.includes(id))) {
        throw new Error('Uma ou mais prioridades não pertencem a este departamento');
      }

      // Validar pesos únicos
      const weights = priorityOrders.map(p => p.weight);
      const uniqueWeights = new Set(weights);
      if (weights.length !== uniqueWeights.size) {
        throw new Error('Pesos duplicados na reordenação');
      }

      logger.debug('Reordering priorities - moving all to temporary weights first', { 
        companyId, 
        departmentId, 
        count: priorityOrders.length 
      });
      
      // Buscar o maior peso atual para usar como base para temporários
      const maxWeight = Math.max(...existingPriorities.map(p => p.weight));
      logger.debug('Max weight found', { maxWeight });

      // PASSO 1: TODAS as prioridades que serão alteradas vão para temporários únicos
      logger.debug('Step 1: Moving all to temporary weights');
      for (let i = 0; i < priorityOrders.length; i++) {
        const { id } = priorityOrders[i];
        const tempWeight = maxWeight + 100 + i; // Temporários únicos bem altos
        
        await db
          .update(departmentPriorities)
          .set({
            weight: tempWeight,
            updated_at: new Date()
          })
          .where(eq(departmentPriorities.id, id));
        
        logger.debug('Moved to temporary weight', { priorityId: id, tempWeight });
      }

      // PASSO 2: TODAS para os pesos finais desejados
      logger.debug('Step 2: Applying final weights');
      const updatedPriorities: DepartmentPriority[] = [];
      
      for (const { id, weight } of priorityOrders) {
        const [updated] = await db
          .update(departmentPriorities)
          .set({
            weight,
            updated_at: new Date()
          })
          .where(eq(departmentPriorities.id, id))
          .returning();
        
        updatedPriorities.push(updated);
        logger.debug('Applied final weight', { priorityId: id, finalWeight: weight });
      }

      logger.debug('Reordering completed successfully', { 
        companyId, 
        departmentId, 
        count: updatedPriorities.length 
      });
      return updatedPriorities.sort((a, b) => a.weight - b.weight);
      
    } catch (error) {
      logger.error('Erro ao reordenar prioridades', { companyId, departmentId, priorityOrders, error });
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Falha ao reordenar prioridades', { cause: error });
    }
  }

  /**
   * Ativa o sistema flexível para uma empresa
   */
  async enableFlexibleSLA(companyId: number): Promise<void> {
    try {
      await db
        .update(companies)
        .set({
          uses_flexible_sla: true,
          updated_at: new Date()
        })
        .where(eq(companies.id, companyId));
        
    } catch (error) {
      logger.error('Erro ao ativar sistema flexível', { companyId, error });
      throw new Error('Falha ao ativar sistema flexível de SLA', { cause: error });
    }
  }

  /**
   * Valida prioridades de um departamento
   */
  async validateDepartmentPriorities(
    companyId: number, 
    departmentId: number
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const result = await this.getDepartmentPriorities(companyId, departmentId);
      return validatePriorityWeights(result.priorities);
      
    } catch (error) {
      logger.error('Erro ao validar prioridades', { companyId, departmentId, error });
      return {
        isValid: false,
        errors: ['Erro ao buscar prioridades para validação'],
        warnings: []
      };
    }
  }
} 