import * as bcrypt from 'bcrypt';

// Número de rounds para o algoritmo de hash - quanto maior, mais seguro, mas também mais lento
const SALT_ROUNDS = 10;

/**
 * Criptografa uma senha usando bcrypt
 * @param password Senha em texto plano
 * @returns Senha criptografada
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se uma senha em texto plano corresponde à senha criptografada
 * @param plainPassword Senha em texto plano
 * @param hashedPassword Senha criptografada
 * @returns True se a senha corresponder, false caso contrário
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}
