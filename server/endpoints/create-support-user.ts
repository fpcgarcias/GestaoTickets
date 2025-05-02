/**
 * Endpoint para criar um usuário de suporte e o respectivo atendente em uma única transação
 * Garante a atomicidade da operação - ou cria ambos os registros ou nenhum
 */

import { Request, Response } from 'express';
import { withTransaction } from '../transaction-manager';
import { IStorage } from '../storage';
import { InsertOfficial, InsertUser } from '@shared/schema';

export async function createSupportUserEndpoint(
  req: Request, 
  res: Response, 
  storage: IStorage,
  hashPassword: (password: string) => Promise<string>
) {
  try {
    console.log('=== Iniciando criação de usuário de suporte e atendente ===');
    console.log('Dados recebidos:', JSON.stringify(req.body, null, 2));
    
    const { 
      username, 
      email, 
      password, 
      name, 
      departments = [],
      avatarUrl = null,
      isActive = true
    } = req.body;
    
    // Verificar campos obrigatórios
    if (!username) {
      return res.status(400).json({ message: "Nome de usuário é obrigatório" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email é obrigatório" });
    }
    if (!password) {
      return res.status(400).json({ message: "Senha é obrigatória" });
    }
    if (!name) {
      return res.status(400).json({ message: "Nome é obrigatório" });
    }
    
    // Verificar se o usuário já existe
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      console.log(`Erro: Nome de usuário '${username}' já existe`);
      return res.status(400).json({ message: "Nome de usuário já existe" });
    }
    
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      console.log(`Erro: Email '${email}' já está em uso`);
      return res.status(400).json({ message: "Email já está em uso" });
    }
    
    // Verificar se já existe um atendente com esse email
    const existingOfficial = await storage.getOfficialByEmail(email);
    if (existingOfficial) {
      console.log(`Erro: Já existe um atendente com o email '${email}'`);
      return res.status(400).json({ message: "Já existe um atendente com este email" });
    }
    
    // Usar uma transação para garantir atomicidade
    const result = await withTransaction(async () => {
      console.log('Iniciando transação para criar usuário e atendente');
      
      // Criptografar senha
      const hashedPassword = await hashPassword(password);
      
      // 1. Criar o usuário
      console.log('Criando usuário com papel "support"');
      const userData: InsertUser = {
        username,
        email,
        password: hashedPassword,
        name,
        role: 'support',
        avatarUrl,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const user = await storage.createUser(userData);
      console.log(`Usuário criado com ID: ${user.id}`);
      
      // 2. Criar o atendente
      console.log(`Criando atendente para usuário ID: ${user.id}`);
      const officialData: InsertOfficial = {
        name,
        email,
        userId: user.id,
        isActive,
        avatarUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const official = await storage.createOfficial(officialData);
      console.log(`Atendente criado com ID: ${official.id}`);
      
      // 3. Adicionar departamentos ao atendente
      if (departments && Array.isArray(departments) && departments.length > 0) {
        console.log(`Adicionando ${departments.length} departamentos ao atendente ID: ${official.id}`);
        
        for (const department of departments) {
          await storage.addOfficialDepartment({
            officialId: official.id,
            department,
            createdAt: new Date()
          });
          console.log(`Departamento '${department}' adicionado ao atendente ID: ${official.id}`);
        }
      }
      
      return { user, official, departments };
    });
    
    // Remover a senha do resultado
    const { user, official, departments } = result;
    const { password: _, ...userWithoutPassword } = user;
    
    // Retornar o resultado completo
    console.log('=== Criação de usuário de suporte e atendente concluída com sucesso ===');
    res.status(201).json({
      user: userWithoutPassword,
      official: {
        ...official,
        departments
      }
    });
  } catch (error: any) {
    console.error('Erro ao criar usuário de suporte e atendente:', error);
    res.status(500).json({
      message: "Falha ao criar usuário e atendente",
      error: error.message || String(error)
    });
  }
}
