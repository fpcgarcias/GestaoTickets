import bcrypt from 'bcryptjs';

// Número de rounds para o algoritmo de hash - quanto maior, mais seguro, mas também mais lento
const SALT_ROUNDS = 10;

/**
 * Criptografa uma senha usando bcrypt
 * @param password Senha em texto puro
 * @returns Senha criptografada
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Verifica se uma senha em texto puro corresponde a uma senha criptografada
 * @param password Senha em texto puro
 * @param hashedPassword Senha criptografada armazenada
 * @returns true se a senha corresponde, false caso contrário
 */
export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Erro ao comparar senhas:', error);
    return false;
  }
}
