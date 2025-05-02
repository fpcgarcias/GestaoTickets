/**
 * Este script localiza e corrige usuários "órfãos" que foram criados como 'support'
 * mas não têm um registro correspondente na tabela 'officials'
 */

import { db } from './db';
import { users, officials } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function findOrphanSupportUsers() {
  console.log('Buscando usuários de suporte órfãos (sem registro de atendente)...');
  
  try {
    // Buscar todos os usuários com papel 'support'
    const supportUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'support'));
    
    console.log(`Encontrados ${supportUsers.length} usuários com papel 'support'`);
    
    // Para cada usuário de suporte, verificar se existe um registro em 'officials'
    const orphanUsers = [];
    for (const user of supportUsers) {
      const [official] = await db
        .select()
        .from(officials)
        .where(eq(officials.userId, user.id));
      
      if (!official) {
        console.log(`Usuário órfão encontrado: ${user.name} (${user.email}), ID: ${user.id}`);
        orphanUsers.push(user);
      }
    }
    
    // Verificar também por email - às vezes há problemas onde userId não foi definido corretamente
    for (const user of supportUsers) {
      const [official] = await db
        .select()
        .from(officials)
        .where(eq(officials.email, user.email));
      
      if (official && !official.userId) {
        console.log(`Atendente encontrado sem userId, mas com mesmo email: ${user.email}`);
        console.log(`ID do usuário: ${user.id}, ID do atendente: ${official.id}`);
        
        // Atualizar o atendente com o userId correto
        try {
          const [updated] = await db
            .update(officials)
            .set({ userId: user.id })
            .where(eq(officials.id, official.id))
            .returning();
            
          console.log(`Atendente atualizado com userId correto: ${updated.id} -> ${updated.userId}`);
        } catch (updateError) {
          console.error(`Erro ao atualizar userId para atendente:`, updateError);
        }
      }
    }
    
    console.log(`Total de usuários órfãos encontrados: ${orphanUsers.length}`);
    return orphanUsers;
  } catch (error) {
    console.error('Erro ao buscar usuários órfãos:', error);
    throw error;
  }
}

export async function createOfficialForUser(userId: number, options: {
  email?: string,
  name?: string,
  isActive?: boolean
} = {}) {
  try {
    // Buscar o usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      throw new Error(`Usuário com ID ${userId} não encontrado`);
    }
    
    console.log(`Criando atendente para usuário: ${user.name}`);
    
    // Criar registro de atendente usando dados do usuário como padrão
    const [official] = await db
      .insert(officials)
      .values({
        name: options.name || user.name,
        email: options.email || user.email,
        userId: user.id,
        isActive: options.isActive !== undefined ? options.isActive : user.active,
        avatarUrl: user.avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`Atendente criado com sucesso: ID=${official.id}`);
    return official;
  } catch (error) {
    console.error(`Erro ao criar atendente para usuário ${userId}:`, error);
    throw error;
  }
}

export async function fixAllOrphanSupportUsers() {
  try {
    const orphanUsers = await findOrphanSupportUsers();
    
    if (orphanUsers.length === 0) {
      console.log('Nenhum usuário órfão encontrado para corrigir.');
      return [];
    }
    
    console.log(`Corrigindo ${orphanUsers.length} usuários órfãos...`);
    
    const results = [];
    for (const user of orphanUsers) {
      try {
        const official = await createOfficialForUser(user.id);
        results.push({
          userId: user.id,
          officialId: official.id,
          success: true
        });
      } catch (error) {
        console.error(`Falha ao corrigir usuário ${user.id}:`, error);
        results.push({
          userId: user.id,
          success: false,
          error: String(error)
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Correção concluída. ${successCount}/${orphanUsers.length} usuários corrigidos com sucesso.`);
    
    return results;
  } catch (error) {
    console.error('Erro ao corrigir usuários órfãos:', error);
    throw error;
  }
}
