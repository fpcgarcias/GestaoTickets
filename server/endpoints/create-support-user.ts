/**
 * Endpoint para criar um usuário de suporte e o respectivo atendente em uma única transação
 * Garante a atomicidade da operação - ou cria ambos os registros ou nenhum
 */

import { Request, Response } from 'express';
import { withTransaction } from '../transaction-manager';
import { IStorage } from '../storage';
import { InsertOfficial, InsertUser, departments as departmentsSchema } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../db';

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
      isActive = true,
      supervisorId = null,
      managerId = null,
      company_id = null // Novo campo para empresa
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
    
    // Verificar se o usuário da sessão é admin e se company_id foi fornecido
    const userRole = req.session?.userRole as string;
    const sessionCompanyId = req.session?.companyId;
    
    let effectiveCompanyId: number | null = null;
    
    if (userRole === 'admin') {
      // Admin pode especificar qualquer company_id ou deixar null
      effectiveCompanyId = company_id;
    } else {
      // Usuários não-admin usam sua própria empresa
      effectiveCompanyId = sessionCompanyId || null;
    }
    
    console.log(`Usuário role: ${userRole}, Company ID efetivo: ${effectiveCompanyId}`);
    
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
        avatar_url: avatarUrl,
        active: true,
        company_id: effectiveCompanyId,
      };
      
      const user = await storage.createUser(userData);
      console.log(`Usuário criado com ID: ${user.id}, Company ID: ${effectiveCompanyId}`);
      
      // 2. Criar o atendente
      console.log(`Criando atendente para usuário ID: ${user.id}`);
      // Garantir que pelo menos um departamento seja fornecido
      if (!userDepartments || !Array.isArray(userDepartments) || userDepartments.length === 0) {
        throw new Error('Pelo menos um departamento deve ser selecionado');
      }

      // Buscar departamentos válidos da base de dados para a empresa
      const availableDepartments = await db
        .select()
        .from(departmentsSchema)
        .where(
          effectiveCompanyId 
            ? eq(departmentsSchema.company_id, effectiveCompanyId)
            : isNull(departmentsSchema.company_id) // Para departamentos globais quando company_id é null
        );
      
      console.log(`Departamentos disponíveis para empresa ${effectiveCompanyId}: ${JSON.stringify(availableDepartments.map(d => d.name))}`);
      
      // Se não houver departamentos, criar um departamento padrão para a empresa
      let defaultDepartment = 'Geral'; // Nome padrão genérico
      
      if (availableDepartments.length > 0) {
        // Usar o primeiro departamento encontrado
        defaultDepartment = availableDepartments[0].name;
      } else {
        console.warn(`Nenhum departamento encontrado para empresa ${effectiveCompanyId}. Usando padrão: ${defaultDepartment}`);
      }
      
      // Forçar conversão para array
      const departmentsArray = Array.isArray(userDepartments) ? userDepartments : [];
      console.log(`Departamentos recebidos (original): ${JSON.stringify(userDepartments)}`);
      console.log(`Departamentos como array: ${JSON.stringify(departmentsArray)}`);
      
      // Validar que há pelo menos um departamento
      if (departmentsArray.length === 0) {
        console.warn('Nenhum departamento foi fornecido! Usando departamento padrão:', defaultDepartment);
      } else {
        const firstDept = departmentsArray[0];
        
        // Processar com base no tipo
        if (typeof firstDept === 'string' && firstDept.trim() !== '') {
          // Verificar se o departamento existe na lista de departamentos disponíveis
          const foundDepartment = availableDepartments.find(
            dept => dept.name.toLowerCase() === firstDept.toLowerCase()
          );
          
          if (foundDepartment) {
            defaultDepartment = foundDepartment.name;
            console.log(`Usando departamento encontrado: ${defaultDepartment}`);
          } else {
            console.warn(`Departamento '${firstDept}' não encontrado na empresa. Disponíveis: ${availableDepartments.map(d => d.name).join(', ')}. Usando padrão: ${defaultDepartment}`);
          }
        } 
        // Se for um objeto, verificar a propriedade 'department'
        else if (typeof firstDept === 'object' && firstDept !== null && 'department' in firstDept) {
          const deptValue = firstDept.department;
          if (typeof deptValue === 'string' && deptValue.trim() !== '') {
            // Verificar se o departamento existe na lista de departamentos disponíveis
            const foundDepartment = availableDepartments.find(
              dept => dept.name.toLowerCase() === deptValue.toLowerCase()
            );
            
            if (foundDepartment) {
              defaultDepartment = foundDepartment.name;
              console.log(`Usando departamento de objeto encontrado: ${defaultDepartment}`);
            } else {
              console.warn(`Departamento de objeto '${deptValue}' não encontrado na empresa. Disponíveis: ${availableDepartments.map(d => d.name).join(', ')}. Usando padrão: ${defaultDepartment}`);
            }
          } else {
            console.warn(`Departamento de objeto vazio, usando padrão: ${defaultDepartment}`);
          }
        } else {
          console.warn(`Tipo de departamento inesperado: ${typeof firstDept}, usando padrão: ${defaultDepartment}`);
        }
      }
      
      console.log(`Departamento final escolhido: ${defaultDepartment}`);
      
      const officialData: any = {
        name,
        email,
        user_id: user.id,
        is_active: isActive,
        avatar_url: avatarUrl,
        department: defaultDepartment, // Para compatibilidade com a coluna existente no banco
        supervisor_id: supervisorId,
        manager_id: managerId,
        company_id: effectiveCompanyId,
      };
      
      const official = await storage.createOfficial(officialData);
      console.log(`Atendente criado com ID: ${official.id}, Company ID: ${effectiveCompanyId}`);
      
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
            official_id: official.id,
            department: departmentValue,
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
