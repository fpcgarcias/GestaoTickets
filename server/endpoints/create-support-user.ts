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
      userDepartments = [],
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
      // Garantir que pelo menos um departamento seja fornecido
      if (!userDepartments || !Array.isArray(userDepartments) || userDepartments.length === 0) {
        throw new Error('Pelo menos um departamento deve ser selecionado');
      }

      // Utilizar o primeiro departamento selecionado como departamento principal (para compatibilidade)
      let defaultDepartment = 'technical'; // Fallback para garantir valor não-nulo
      
      // Garantir que userDepartments seja sempre um array de strings
      const departmentsArray = Array.isArray(userDepartments) ? userDepartments : [];
      console.log(`Departamentos recebidos: ${JSON.stringify(departmentsArray)}`);
      
      if (departmentsArray.length > 0) {
        // Se o valor for um objeto com propriedade 'department'
        if (typeof departmentsArray[0] === 'object' && departmentsArray[0] !== null && 'department' in departmentsArray[0]) {
          defaultDepartment = departmentsArray[0].department;
        } 
        // Se for uma string
        else if (typeof departmentsArray[0] === 'string') {
          defaultDepartment = departmentsArray[0];
        }
      }
      
      console.log(`Departamento padrão selecionado: ${defaultDepartment}`);
      
      const officialData: any = {
        name,
        email,
        userId: user.id,
        isActive,
        avatarUrl,
        department: defaultDepartment, // Para compatibilidade com a coluna existente no banco
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const official = await storage.createOfficial(officialData);
      console.log(`Atendente criado com ID: ${official.id}`);
      
      // 3. Adicionar departamentos ao atendente
      if (departmentsArray.length > 0) {
        console.log(`Adicionando ${departmentsArray.length} departamentos ao atendente ID: ${official.id}`);
        
        for (const dept of departmentsArray) {
          // Determinar o valor correto do departamento (string ou objeto)
          let departmentValue;
          if (typeof dept === 'object' && dept !== null && 'department' in dept) {
            departmentValue = dept.department;
          } else if (typeof dept === 'string') {
            departmentValue = dept;
          } else {
            console.log(`Ignorando departamento de formato inválido: ${JSON.stringify(dept)}`);
            continue; // Pular este departamento
          }
          
          await storage.addOfficialDepartment({
            officialId: official.id,
            department: departmentValue,
            createdAt: new Date()
          });
          console.log(`Departamento '${departmentValue}' adicionado ao atendente ID: ${official.id}`);
        }
      }
      
      return { user, official, userDepartments };
    });
    
    // Remover a senha do resultado
    const { user, official, userDepartments: departments } = result;
    const { password: _, ...userWithoutPassword } = user;
    
    // Retornar o resultado completo
    console.log('=== Criação de usuário de suporte e atendente concluída com sucesso ===');
    res.status(201).json({
      user: userWithoutPassword,
      official: {
        ...official,
        departments: departments
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
