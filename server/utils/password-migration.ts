import { db } from '../db';
import { users } from '@shared/schema';
import { hashPassword } from './password';
import { eq } from 'drizzle-orm';

/**
 * Função para diagnosticar problemas de senha sem fazer alterações
 */
export async function diagnosePaswordIssues(): Promise<void> {
  try {
    console.log('🔍 Diagnosticando problemas de senha...');
    
    const allUsers = await db.select().from(users);
    const usersNeedingMigration = allUsers.filter(user => user.password && !user.password.startsWith('$2'));
    
    if (usersNeedingMigration.length === 0) {
      console.log('✅ Nenhum usuário precisa de migração de senha');
      return;
    }

    console.log(`🔍 Analisando ${usersNeedingMigration.length} usuário(s) que precisam de migração:`);
    
    for (const user of usersNeedingMigration) {
      console.log(`\n👤 Usuário: ${user.username} (ID: ${user.id})`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Senha: "${user.password}" (${user.password?.length || 0} caracteres)`);
      
      // Simular validação sem fazer hash
      try {
        const { validatePasswordStrength } = await import('./password');
        const validation = validatePasswordStrength(user.password);
        
        if (validation.valid) {
          console.log(`   ✅ Senha válida - pode ser migrada`);
        } else {
          console.log(`   ❌ Problemas encontrados:`);
          validation.errors.forEach((error, index) => {
            console.log(`      - ${error} (${validation.errorCodes[index]})`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Erro ao validar: ${error}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  }
}

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
      try {
        console.log(`🔐 Criptografando senha para o usuário: ${user.username} (ID: ${user.id})`);
        
        // Criar hash da senha atual
        const hashedPassword = await hashPassword(user.password);
        
        // Atualizar no banco de dados
        await db.update(users)
          .set({ password: hashedPassword })
          .where(eq(users.id, user.id));
          
        console.log(`✅ Senha criptografada com sucesso para: ${user.username}`);
      } catch (error: any) {
        console.error(`❌ Erro ao criptografar senha para o usuário: ${user.username} (ID: ${user.id})`);
        console.error(`   Email: ${user.email || 'N/A'}`);
        console.error(`   Senha atual: "${user.password}" (${user.password?.length || 0} caracteres)`);
        
        if (error.passwordErrors) {
          console.error(`   Problemas de validação:`, error.passwordErrors);
        }
        
        console.error(`   Erro completo:`, error.message);
        
        // Continuar com os próximos usuários ao invés de parar tudo
        continue;
      }
    }
    
    console.log('✅ Criptografia de senhas concluída!');
  } catch (error) {
    console.error('❌ Erro geral na migração de senhas:', error);
    // Não lançar erro para não interromper o startup do servidor
  }
} 