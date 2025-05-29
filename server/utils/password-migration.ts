import { db } from '../db';
import { users } from '@shared/schema';
import { hashPassword } from './password';
import { eq } from 'drizzle-orm';

/**
 * Função para criptografar senhas não criptografadas
 * Este script lê todas as senhas não criptografadas e as substitui por versões com hash
 */
export async function migratePasswords(): Promise<void> {
  try {
    console.log('🔐 Verificando criptografia de senhas...');
    
    // Buscar todos os usuários
    const allUsers = await db.select().from(users);
    
    // Primeiro, verificar quantos usuários precisam de migração
    const usersNeedingMigration = allUsers.filter(user => user.password && !user.password.startsWith('$2'));
    
    if (usersNeedingMigration.length === 0) {
      console.log(`✅ Todas as ${allUsers.length} senhas já estão criptografadas`);
      return;
    }

    console.log(`🔐 Criptografando senhas para ${usersNeedingMigration.length} usuário(s)...`);
    
    // Para cada usuário que precisa de migração
    for (const user of usersNeedingMigration) {
      console.log(`🔐 Criptografando senha para o usuário: ${user.username}`);
      
      // Criar hash da senha atual
      const hashedPassword = await hashPassword(user.password);
      
      // Atualizar no banco de dados
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
    }
    
    console.log('✅ Criptografia de senhas concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criptografar senhas:', error);
    // Não lançar erro para não interromper o startup do servidor
  }
} 