#!/usr/bin/env node

/**
 * Script para corrigir senhas problemáticas
 * Execute: node scripts/fix-problematic-passwords.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  try {
    console.log('🔧 Iniciando correção de senhas problemáticas...\n');
    
    // Importar dependências
    const { db } = await import('../server/db/index.js');
    const { users } = await import('../shared/schema.js');
    const { generateSecurePassword, hashPassword, validatePasswordStrength } = await import('../server/utils/password.js');
    const { eq } = await import('drizzle-orm');
    
    // Buscar usuários que precisam de migração
    const allUsers = await db.select().from(users);
    const usersNeedingMigration = allUsers.filter(user => user.password && !user.password.startsWith('$2'));
    
    if (usersNeedingMigration.length === 0) {
      console.log('✅ Nenhum usuário precisa de correção de senha');
      return;
    }

    console.log(`🔧 Analisando ${usersNeedingMigration.length} usuário(s)...\n`);
    
    const problematicUsers = [];
    
    // Identificar usuários com senhas problemáticas
    for (const user of usersNeedingMigration) {
      const validation = validatePasswordStrength(user.password);
      if (!validation.valid) {
        problematicUsers.push({
          user,
          errors: validation.errors,
          errorCodes: validation.errorCodes
        });
      }
    }
    
    if (problematicUsers.length === 0) {
      console.log('✅ Todas as senhas não criptografadas são válidas!');
      return;
    }
    
    console.log(`❌ Encontrados ${problematicUsers.length} usuário(s) com senhas problemáticas:\n`);
    
    // Mostrar problemas encontrados
    problematicUsers.forEach(({ user, errors }, index) => {
      console.log(`${index + 1}. 👤 ${user.username} (${user.email || 'sem email'})`);
      console.log(`   Senha atual: "${user.password}"`);
      console.log(`   Problemas:`);
      errors.forEach(error => console.log(`     - ${error}`));
      console.log('');
    });
    
    // Perguntar se deve prosseguir (simulação - em produção você removeria isso)
    console.log('🚨 ATENÇÃO: Este script irá gerar senhas temporárias para os usuários problemáticos!');
    console.log('📧 Você deve notificar os usuários sobre suas novas senhas temporárias.\n');
    
    // Processar cada usuário problemático
    const fixedUsers = [];
    
    for (const { user } of problematicUsers) {
      try {
        // Gerar senha temporária segura
        const tempPassword = generateSecurePassword(12);
        const hashedPassword = await hashPassword(tempPassword);
        
        // Atualizar no banco
        await db.update(users)
          .set({ 
            password: hashedPassword,
            // Você pode adicionar um campo para marcar que precisa trocar a senha
            // password_reset_required: true 
          })
          .where(eq(users.id, user.id));
        
        fixedUsers.push({
          username: user.username,
          email: user.email,
          tempPassword
        });
        
        console.log(`✅ Corrigido: ${user.username}`);
        
      } catch (error) {
        console.error(`❌ Erro ao corrigir ${user.username}:`, error.message);
      }
    }
    
    if (fixedUsers.length > 0) {
      console.log('\n📋 SENHAS TEMPORÁRIAS GERADAS:');
      console.log('=' .repeat(50));
      fixedUsers.forEach(({ username, email, tempPassword }) => {
        console.log(`👤 ${username} (${email || 'sem email'})`);
        console.log(`🔑 Senha temporária: ${tempPassword}`);
        console.log('-'.repeat(30));
      });
      
      console.log('\n📧 IMPORTANTE: Notifique estes usuários sobre suas novas senhas temporárias!');
      console.log('💡 Considere implementar um sistema de reset obrigatório no primeiro login.');
    }
    
  } catch (error) {
    console.error('❌ Erro na correção:', error);
    process.exit(1);
  }
}

main();