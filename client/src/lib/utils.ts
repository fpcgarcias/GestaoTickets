import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('pt-BR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  });
}

export function generateTicketId(): string {
  const year = new Date().getFullYear();
  const letters = 'CS';
  const numbers = Math.floor(Math.random() * 9000) + 1000;
  return `${year}-${letters}${numbers}`;
}

export const TICKET_STATUS = {
  NEW: 'new',
  ONGOING: 'ongoing',
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
  [TICKET_STATUS.NEW]: 'bg-amber-100 text-amber-800',
  [TICKET_STATUS.ONGOING]: 'bg-blue-100 text-blue-800',
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

// Função para traduzir status para português brasileiro
export function translateTicketStatus(status: string): string {
  const statusTranslations: Record<string, string> = {
    'new': 'Novo',
    'ongoing': 'Em Andamento', 
    'resolved': 'Resolvido',
    'in_progress': 'Em Andamento',
    'closed': 'Fechado',
    'cancelled': 'Cancelado',
    'pending': 'Pendente'
  };
  
  return statusTranslations[status] || status;
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
