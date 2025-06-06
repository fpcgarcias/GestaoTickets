import { isUserInGroup } from '../utils/active-directory';

/**
 * Mapeamento de grupos do Active Directory para roles do sistema
 * Essas variáveis devem ser configuradas no .env
 */
const AD_GROUP_MAPPINGS = {
  // Grupos de administração
  admin: process.env.AD_ADMIN_GROUP || 'SistemaGestao-Admins',
  company_admin: process.env.AD_COMPANY_ADMIN_GROUP || 'SistemaGestao-CompanyAdmin',
  
  // Grupos de gerenciamento
  manager: process.env.AD_MANAGER_GROUP || 'SistemaGestao-Managers',
  supervisor: process.env.AD_SUPERVISOR_GROUP || 'SistemaGestao-Supervisors',
  
  // Grupos de suporte
  support: process.env.AD_SUPPORT_GROUP || 'SistemaGestao-Support',
  triage: process.env.AD_TRIAGE_GROUP || 'SistemaGestao-Triage',
  quality: process.env.AD_QUALITY_GROUP || 'SistemaGestao-Quality',
  
  // Grupos de visualização
  viewer: process.env.AD_VIEWER_GROUP || 'SistemaGestao-Viewers',
  
  // Grupos de clientes
  customer: process.env.AD_CUSTOMER_GROUP || 'SistemaGestao-Customers',
  
  // Grupos especiais
  integration_bot: process.env.AD_INTEGRATION_BOT_GROUP || 'SistemaGestao-Bots'
};

/**
 * Ordem de prioridade dos roles (do maior para o menor privilégio)
 * O primeiro role encontrado será usado
 */
const ROLE_PRIORITY = [
  'admin',
  'company_admin', 
  'manager',
  'supervisor',
  'support',
  'triage',
  'quality',
  'viewer',
  'integration_bot',
  'customer' // Role padrão com menor privilégio
];

/**
 * Interface para resultado do mapeamento de role
 */
export interface ADRoleMappingResult {
  role: string;
  groups: string[];
  mappedGroups: { [key: string]: boolean };
}

/**
 * Mapeia os grupos do AD de um usuário para um role do sistema
 * @param username Nome de usuário no AD
 * @param userGroups Lista de grupos do usuário (opcional, para otimização)
 * @returns Role determinado e informações de debug
 */
export async function mapADGroupsToRole(
  username: string, 
  userGroups?: string[]
): Promise<ADRoleMappingResult> {
  const mappedGroups: { [key: string]: boolean } = {};
  const foundGroups: string[] = [];

  try {
    // Verificar cada grupo do AD para cada role
    for (const role of ROLE_PRIORITY) {
      const adGroup = AD_GROUP_MAPPINGS[role as keyof typeof AD_GROUP_MAPPINGS];
      
      if (!adGroup) {
        console.warn(`⚠️ [AD] Grupo do AD não configurado para role '${role}'`);
        mappedGroups[role] = false;
        continue;
      }

      let isMember = false;

      // Se temos a lista de grupos do usuário, verificar diretamente
      if (userGroups && Array.isArray(userGroups)) {
        isMember = userGroups.some(group => 
          group.toLowerCase().includes(adGroup.toLowerCase()) ||
          adGroup.toLowerCase().includes(group.toLowerCase())
        );
      } else {
        // Caso contrário, consultar o AD
        isMember = await isUserInGroup(username, adGroup);
      }

      mappedGroups[role] = isMember;

      if (isMember) {
        foundGroups.push(adGroup);
        console.log(`✅ [AD] Usuário '${username}' é membro do grupo '${adGroup}' (role: ${role})`);
        
        // Retornar o primeiro role encontrado (maior prioridade)
        return {
          role,
          groups: foundGroups,
          mappedGroups
        };
      }
    }

    // Se nenhum grupo específico foi encontrado, usar 'customer' como padrão
    console.log(`⚠️ [AD] Usuário '${username}' não pertence a nenhum grupo específico. Usando role padrão: customer`);
    
    return {
      role: 'customer',
      groups: foundGroups,
      mappedGroups
    };

  } catch (error) {
    console.error(`❌ [AD] Erro ao mapear grupos para role do usuário '${username}':`, error);
    
    // Em caso de erro, usar role padrão
    return {
      role: 'customer',
      groups: [],
      mappedGroups: {}
    };
  }
}

/**
 * Extrai grupos dos dados brutos do AD
 * @param adUserData Dados do usuário retornados pelo AD
 * @returns Lista de grupos do usuário
 */
export function extractGroupsFromADUser(adUserData: any): string[] {
  const groups: string[] = [];

  if (!adUserData) {
    return groups;
  }

  // Verificar o campo memberOf
  if (adUserData.memberOf) {
    if (Array.isArray(adUserData.memberOf)) {
      // Se é um array, processar cada grupo
      for (const group of adUserData.memberOf) {
        if (typeof group === 'string') {
          // Extrair o nome do grupo do DN (Distinguished Name)
          // Exemplo: "CN=SistemaGestao-Admins,OU=Groups,DC=vixbrasil,DC=local"
          const cnMatch = group.match(/CN=([^,]+)/i);
          if (cnMatch && cnMatch[1]) {
            groups.push(cnMatch[1]);
          }
        }
      }
    } else if (typeof adUserData.memberOf === 'string') {
      // Se é string única, processar
      const cnMatch = adUserData.memberOf.match(/CN=([^,]+)/i);
      if (cnMatch && cnMatch[1]) {
        groups.push(cnMatch[1]);
      }
    }
  }

  return groups;
}

/**
 * Valida se as configurações de grupos do AD estão corretas
 * @returns Resultado da validação
 */
export function validateADGroupConfiguration(): {
  isValid: boolean;
  missingGroups: string[];
  configuredGroups: { [key: string]: string };
} {
  const missingGroups: string[] = [];
  const configuredGroups: { [key: string]: string } = {};

  for (const role of ROLE_PRIORITY) {
    const group = AD_GROUP_MAPPINGS[role as keyof typeof AD_GROUP_MAPPINGS];
    if (group) {
      configuredGroups[role] = group;
    } else {
      missingGroups.push(role);
    }
  }

  return {
    isValid: missingGroups.length === 0,
    missingGroups,
    configuredGroups
  };
}

/**
 * Obtém todos os grupos configurados para mapeamento
 * @returns Mapeamento completo de roles para grupos
 */
export function getADGroupMappings(): typeof AD_GROUP_MAPPINGS {
  return { ...AD_GROUP_MAPPINGS };
} 