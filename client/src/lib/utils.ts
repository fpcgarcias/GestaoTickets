import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getAiBotName } from "@/utils/ai-bot-names";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number, locale: string = 'pt-BR'): string {
  const d = new Date(date);
  
  if (locale === 'en-US') {
    // Formato americano: MM/dd/yyyy h:mm AM/PM
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } else {
    // Formato brasileiro: dd/MM/yyyy HH:mm
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ' ' + d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



export const TICKET_STATUS = {
  NEW: 'new',
  ONGOING: 'ongoing',
  SUSPENDED: 'suspended',
  WAITING_CUSTOMER: 'waiting_customer',
  ESCALATED: 'escalated',
  IN_ANALYSIS: 'in_analysis',
  PENDING_DEPLOYMENT: 'pending_deployment',
  REOPENED: 'reopened',
  RESOLVED: 'resolved'
};

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const PRIORITY_COLORS = {
  [PRIORITY_LEVELS.LOW]: 'bg-blue-200 text-blue-800',
  [PRIORITY_LEVELS.MEDIUM]: 'bg-yellow-200 text-yellow-800',
  [PRIORITY_LEVELS.HIGH]: 'bg-red-500 text-white',
  [PRIORITY_LEVELS.CRITICAL]: 'bg-red-800 text-white'
};

export const STATUS_COLORS = {
  [TICKET_STATUS.NEW]: 'bg-blue-100 text-blue-800',
  [TICKET_STATUS.ONGOING]: 'bg-yellow-100 text-yellow-800',
  [TICKET_STATUS.SUSPENDED]: 'bg-orange-100 text-orange-800',
  [TICKET_STATUS.WAITING_CUSTOMER]: 'bg-purple-100 text-purple-800',
  [TICKET_STATUS.ESCALATED]: 'bg-red-100 text-red-800',
  [TICKET_STATUS.IN_ANALYSIS]: 'bg-indigo-100 text-indigo-800',
  [TICKET_STATUS.PENDING_DEPLOYMENT]: 'bg-cyan-100 text-cyan-800',
  [TICKET_STATUS.REOPENED]: 'bg-pink-100 text-pink-800',
  [TICKET_STATUS.RESOLVED]: 'bg-green-100 text-green-800'
};

export const TICKET_TYPES = [
  { value: 'technical', label: 'Problema Técnico', departmentId: 1 },
  { value: 'billing', label: 'Dúvida de Faturamento', departmentId: 2 },
  { value: 'inquiry', label: 'Pedido de Informação', departmentId: 3 },
  { value: 'complaint', label: 'Reclamação', departmentId: 3 }
];

export const DEPARTMENTS = [
  { id: 1, value: '1', label: 'Suporte Técnico' },
  { id: 2, value: '2', label: 'Faturamento' },
  { id: 3, value: '3', label: 'Atendimento ao Cliente' }
];

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
  { value: 'custom', label: 'Período Personalizado' }
];

// Função para traduzir status de tickets para português
export function translateTicketStatus(status: string): string {
  const translations: Record<string, string> = {
    'new': 'Novo',
    'ongoing': 'Em Andamento', 
    'suspended': 'Suspenso',
    'waiting_customer': 'Aguardando Cliente',
    'escalated': 'Escalado',
    'in_analysis': 'Em Análise',
    'pending_deployment': 'Aguardando Deploy',
    'reopened': 'Reaberto',
    'resolved': 'Resolvido',
    // Valores especiais
    'undefined': 'Não Definido',
    'null': 'Não Definido',
    '': 'Não Definido'
  };
  
  return translations[status] || status;
}

// 🆕 Funções para formatação de CNPJ
export function formatCNPJ(cnpj: string): string {
  // Remove todos os caracteres não numéricos
  const numbers = cnpj.replace(/\D/g, '');
  
  // Se não tiver números suficientes, retorna como está
  if (numbers.length !== 14) {
    return cnpj;
  }
  
  // Aplica a formatação: XX.XXX.XXX/0001-XX
  return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function cleanCNPJ(cnpj: string): string {
  // Remove todos os caracteres não numéricos para salvar no banco
  return cnpj.replace(/\D/g, '');
}

export function isValidCNPJ(cnpj: string): boolean {
  // Remove formatação
  const numbers = cleanCNPJ(cnpj);
  
  // Verifica se tem 14 dígitos
  if (numbers.length !== 14) {
    return false;
  }
  
  // Verifica se não são todos iguais (ex: 11111111111111)
  if (/^(\d)\1+$/.test(numbers)) {
    return false;
  }
  
  // Validação dos dígitos verificadores do CNPJ
  let soma = 0;
  let resto;
  
  // Primeiro dígito verificador
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    soma += parseInt(numbers[i]) * pesos1[i];
  }
  resto = soma % 11;
  const digito1 = resto < 2 ? 0 : 11 - resto;
  
  if (parseInt(numbers[12]) !== digito1) {
    return false;
  }
  
  // Segundo dígito verificador
  soma = 0;
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    soma += parseInt(numbers[i]) * pesos2[i];
  }
  resto = soma % 11;
  const digito2 = resto < 2 ? 0 : 11 - resto;
  
  return parseInt(numbers[13]) === digito2;
}

/**
 * Gera uma senha segura que atende aos critérios de segurança:
 * - Pelo menos 8 caracteres
 * - Pelo menos uma letra minúscula
 * - Pelo menos uma letra maiúscula
 * - Pelo menos um número
 * - Pelo menos um caractere especial (@$!%*?&)
 */
export function generateSecurePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Garantir pelo menos um caractere de cada tipo obrigatório
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Preencher o resto aleatoriamente
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar a senha para que os caracteres obrigatórios não fiquem sempre no início
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Valida critérios individuais de senha para feedback visual
 */
export interface PasswordCriteria {
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export function validatePasswordCriteria(password: string): PasswordCriteria {
  return {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password)
  };
}

/**
 * Verifica se a senha atende a todos os critérios
 */
export function isPasswordValid(password: string): boolean {
  const criteria = validatePasswordCriteria(password);
  return Object.values(criteria).every(criterion => criterion);
}

// Função para traduzir roles de usuários para labels mais amigáveis
export const translateUserRole = (role: string, locale: string = 'pt-BR'): string => {
  // Se for o bot de IA, usar a função de internacionalização
  if (role === 'integration_bot') {
    return `🤖 ${getAiBotName(locale)}`;
  }
  
  const roleMap: Record<string, string> = {
    'admin': '👑 Admin',
    'support': '🎧 Suporte',
    'customer': '👤 Cliente',
    'quality': '📝 Qualidade',
    'triage': '🔍 Triagem',
    'company_admin': '🏢 Administrador',
    'viewer': '👁️ Visualizador',
    'supervisor': '👨‍💼 Supervisor',
    'manager': '📊 Gestor'
  };
  return roleMap[role] || role;
};
