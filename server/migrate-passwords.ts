import { db } from './db';
import { users } from '@shared/schema';
import { hashPassword } from './utils/password';
import { eq } from 'drizzle-orm';

/**
 * Script para migrar senhas para formato bcrypt
 * Este script lê todas as senhas não criptografadas e as substitui por versões com hash
 */
export async function migratePasswords() {
  console.log('Iniciando migração de senhas...');
  
  try {
    // Buscar todos os usuários
    const allUsers = await db.select().from(users);
    console.log(`Encontrados ${allUsers.length} usuários para processar`);
    
    // Para cada usuário, verificar se a senha já está criptografada
    // As senhas criptografadas com bcrypt sempre começam com $2a$ ou $2b$
    for (const user of allUsers) {
      if (!user.password.startsWith('$2')) {
        console.log(`Atualizando senha para o usuário: ${user.username}`);
        
        // Criar hash da senha atual
        const hashedPassword = await hashPassword(user.password);
        
        // Atualizar no banco de dados
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
      } else {
        console.log(`Senha do usuário ${user.username} já está criptografada, pulando`);
      }
    }
    
    console.log('Migração de senhas concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao migrar senhas:', error);
    throw error;
  }
}
