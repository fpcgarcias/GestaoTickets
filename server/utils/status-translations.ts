/**
 * Módulo centralizado de tradução de status, prioridades e roles
 * 
 * Este módulo fornece uma única fonte de verdade para traduções de enums
 * do sistema, suportando múltiplos idiomas (pt-BR e en-US).
 */

export type SupportedLanguage = 'pt-BR' | 'en-US';

export interface TranslationMaps {
  'pt-BR': Record<string, string>;
  'en-US': Record<string, string>;
}

/**
 * Mapeamento de tradução de status de tickets
 * Cobre todos os status do sistema: new, ongoing, suspended, waiting_customer,
 * escalated, in_analysis, pending_deployment, reopened, resolved, closed
 */
export const STATUS_TRANSLATIONS: TranslationMaps = {
  'pt-BR': {
    'new': 'Novo',
    'ongoing': 'Em Andamento',
    'suspended': 'Suspenso',
    'waiting_customer': 'Aguardando Solicitante',
    'escalated': 'Escalado',
    'in_analysis': 'Em Análise',
    'pending_deployment': 'Aguardando Deploy',
    'reopened': 'Reaberto',
    'resolved': 'Resolvido',
    'closed': 'Encerrado',
    'undefined': 'Não Definido',
    'null': 'Não Definido',
    '': 'Não Definido'
  },
  'en-US': {
    'new': 'New',
    'ongoing': 'In Progress',
    'suspended': 'Suspended',
    'waiting_customer': 'Waiting for Customer',
    'escalated': 'Escalated',
    'in_analysis': 'In Analysis',
    'pending_deployment': 'Pending Deployment',
    'reopened': 'Reopened',
    'resolved': 'Resolved',
    'closed': 'Closed',
    'undefined': 'Not Defined',
    'null': 'Not Defined',
    '': 'Not Defined'
  }
};

/**
 * Mapeamento de tradução de prioridades de tickets
 */
export const PRIORITY_TRANSLATIONS: TranslationMaps = {
  'pt-BR': {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'critical': 'Crítica'
  },
  'en-US': {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical'
  }
};

/**
 * Mapeamento de tradução de roles de usuários
 */
export const ROLE_TRANSLATIONS: TranslationMaps = {
  'pt-BR': {
    'admin': 'Administrador',
    'support': 'Suporte',
    'customer': 'Solicitante',
    'integration_bot': 'Bot de Integração',
    'quality': 'Qualidade',
    'triage': 'Triagem',
    'company_admin': 'Administrador da Empresa',
    'viewer': 'Visualizador',
    'supervisor': 'Supervisor',
    'manager': 'Gerente'
  },
  'en-US': {
    'admin': 'Administrator',
    'support': 'Support',
    'customer': 'Customer',
    'integration_bot': 'Integration Bot',
    'quality': 'Quality',
    'triage': 'Triage',
    'company_admin': 'Company Administrator',
    'viewer': 'Viewer',
    'supervisor': 'Supervisor',
    'manager': 'Manager'
  }
};

/**
 * Traduz um status de ticket para o idioma especificado
 * 
 * @param status - Status do ticket (ex: 'new', 'ongoing', 'closed')
 * @param language - Idioma de destino ('pt-BR' ou 'en-US')
 * @returns Texto traduzido do status, ou o valor original se não encontrado
 * 
 * @example
 * translateStatus('waiting_customer', 'pt-BR') // 'Aguardando Solicitante'
 * translateStatus('waiting_customer', 'en-US') // 'Waiting for Customer'
 * translateStatus('unknown_status', 'pt-BR') // 'unknown_status' (fallback)
 */
export function translateStatus(status: string, language: SupportedLanguage = 'pt-BR'): string {
  return STATUS_TRANSLATIONS[language][status] || status;
}

/**
 * Traduz uma prioridade de ticket para o idioma especificado
 * 
 * @param priority - Prioridade do ticket (ex: 'low', 'high', 'critical')
 * @param language - Idioma de destino ('pt-BR' ou 'en-US')
 * @returns Texto traduzido da prioridade, ou o valor original se não encontrado
 * 
 * @example
 * translatePriority('high', 'pt-BR') // 'Alta'
 * translatePriority('high', 'en-US') // 'High'
 */
export function translatePriority(priority: string, language: SupportedLanguage = 'pt-BR'): string {
  return PRIORITY_TRANSLATIONS[language][priority] || priority;
}

/**
 * Traduz uma role de usuário para o idioma especificado
 * 
 * @param role - Role do usuário (ex: 'admin', 'support', 'customer')
 * @param language - Idioma de destino ('pt-BR' ou 'en-US')
 * @returns Texto traduzido da role, ou o valor original se não encontrado
 * 
 * @example
 * translateRole('support', 'pt-BR') // 'Suporte'
 * translateRole('support', 'en-US') // 'Support'
 */
export function translateRole(role: string, language: SupportedLanguage = 'pt-BR'): string {
  return ROLE_TRANSLATIONS[language][role] || role;
}

/**
 * Detecta o idioma baseado no domínio da empresa
 * 
 * Regras de detecção:
 * - Se o domínio contém 'vixpaulahermanny.com' → 'en-US'
 * - Caso contrário → 'pt-BR' (padrão)
 * 
 * @param domain - Domínio da empresa (pode ser null ou undefined)
 * @returns Idioma detectado ('pt-BR' ou 'en-US')
 * 
 * @example
 * detectLanguageFromDomain('vixpaulahermanny.com') // 'en-US'
 * detectLanguageFromDomain('minhaempresa.com.br') // 'pt-BR'
 * detectLanguageFromDomain(null) // 'pt-BR'
 */
export function detectLanguageFromDomain(domain: string | null | undefined): SupportedLanguage {
  if (domain && domain.includes('vixpaulahermanny.com')) {
    return 'en-US';
  }
  return 'pt-BR';
}
