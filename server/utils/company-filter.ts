import { logger } from '../services/logger';

/**
 * Interpreta SCHEDULER_COMPANY_FILTER e retorna uma função predicado.
 * 
 * Formatos suportados:
 * - '*' ou vazio: todas as empresas
 * - '<>id': todas exceto a empresa com o ID especificado
 * - 'id1,id2,...': apenas as empresas com os IDs na lista
 * - 'id': apenas a empresa com o ID especificado
 * 
 * @param filter - String do filtro de empresas
 * @returns Função predicado que retorna true se o companyId deve ser incluído
 */
export function parseCompanyFilter(filter: string): (companyId: number) => boolean {
  const trimmedFilter = filter.trim();

  // Formato: '*' ou vazio → todas as empresas
  if (trimmedFilter === '*' || trimmedFilter === '') {
    return () => true;
  }

  // Formato: '<>id' → todas exceto a empresa especificada
  if (trimmedFilter.startsWith('<>')) {
    const excludeIdStr = trimmedFilter.substring(2).trim();
    const excludeId = parseInt(excludeIdStr, 10);
    
    if (isNaN(excludeId)) {
      logger.warn(`[company-filter] Formato de exclusão inválido: "${trimmedFilter}". Ignorando filtro.`);
      return () => true;
    }
    
    return (companyId: number) => companyId !== excludeId;
  }

  // Formato: 'id1,id2,...' ou 'id' → lista de IDs permitidos
  const idStrings = trimmedFilter.split(',').map(s => s.trim());
  const validIds: number[] = [];

  for (const idStr of idStrings) {
    const id = parseInt(idStr, 10);
    
    if (isNaN(id)) {
      logger.warn(`[company-filter] Valor não-numérico ignorado na lista: "${idStr}"`);
      continue;
    }
    
    validIds.push(id);
  }

  // Se nenhum ID válido foi encontrado, permitir todas as empresas
  if (validIds.length === 0) {
    logger.warn(`[company-filter] Nenhum ID válido encontrado no filtro: "${trimmedFilter}". Permitindo todas as empresas.`);
    return () => true;
  }

  return (companyId: number) => validIds.includes(companyId);
}

/**
 * Expande o filtro para uma lista de company IDs (útil para digests).
 * 
 * @param filter - String do filtro de empresas
 * @param allCompanyIds - Array com todos os IDs de empresas ativas
 * @returns Array de IDs de empresas filtrados
 */
export function expandCompanyFilter(
  filter: string,
  allCompanyIds: number[]
): number[] {
  const predicate = parseCompanyFilter(filter);
  return allCompanyIds.filter(predicate);
}
