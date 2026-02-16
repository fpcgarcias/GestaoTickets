import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Configurações de segurança
const SALT_ROUNDS = 12; // Alto nível de segurança
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Regex para validação de senha forte (não utilizado atualmente)
const _PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

/**
 * Valida se a senha atende aos critérios de segurança
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[], errorCodes: string[] } {
  const errors: string[] = [];
  const errorCodes: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
    errorCodes.push('password_too_short');
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres`);
    errorCodes.push('password_too_long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra minúscula');
    errorCodes.push('password_no_lowercase');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Senha deve conter pelo menos uma letra maiúscula');
    errorCodes.push('password_no_uppercase');
  }

  if (!/\d/.test(password)) {
    errors.push('Senha deve conter pelo menos um número');
    errorCodes.push('password_no_number');
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Senha deve conter pelo menos um caractere especial (@$!%*?&)');
    errorCodes.push('password_no_special');
  }

  // Verificar sequências comuns
  const commonSequences = ['123456', 'abcdef', 'qwerty', 'password', 'admin'];
  const lowerPassword = password.toLowerCase();
  
  for (const sequence of commonSequences) {
    if (lowerPassword.includes(sequence)) {
      errors.push('Senha não pode conter sequências comuns');
      errorCodes.push('password_common_sequence');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    errorCodes
  };
}

/**
 * Gera hash seguro da senha
 */
export async function hashPassword(password: string): Promise<string> {
  // Validar força da senha
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    const error = new Error('Password validation failed');
    (error as any).passwordErrors = validation.errorCodes;
    throw error;
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Erro ao gerar hash da senha:', error);
    throw new Error('Erro interno ao processar senha', { cause: error });
  }
}

/**
 * Verifica se a senha corresponde ao hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    return false;
  }
}

/**
 * Gera senha temporária segura
 */
export function generateSecurePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Garantir pelo menos um caractere de cada tipo
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Preencher o resto aleatoriamente
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Gera token seguro para reset de senha
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verifica se a senha foi comprometida (lista básica)
 */
export function checkCommonPasswords(password: string): boolean {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'shadow', 'superman', 'michael'
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}

/**
 * Calcula força da senha (0-100)
 */
export function calculatePasswordStrength(password: string): { score: number; feedback: string } {
  let score = 0;

  // Comprimento
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Variedade de caracteres
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[@$!%*?&]/.test(password)) score += 15;

  // Penalidades
  if (checkCommonPasswords(password)) score -= 30;
  if (/(.)\1{2,}/.test(password)) score -= 15; // Caracteres repetidos

  // Feedback
  let feedback: string;
  if (score < 30) feedback = 'Muito fraca';
  else if (score < 50) feedback = 'Fraca';
  else if (score < 70) feedback = 'Média';
  else if (score < 90) feedback = 'Forte';
  else feedback = 'Muito forte';
  return { score: Math.max(0, Math.min(100, score)), feedback };
}
