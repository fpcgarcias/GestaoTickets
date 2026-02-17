/**
 * Endpoints unificados para gestão de pessoas (usuários + perfis Solicitante/Atendente).
 * Mantém tabelas users, customers e officials intactas; orquestra criação/edição nas três.
 */

import { Request, Response } from 'express';
import { withTransaction } from '../transaction-manager';
import { IStorage } from '../storage';
import * as schema from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';

const { users, customers, officials, officialDepartments, departments, sectors } = schema;

/** Roles que cada perfil pode atribuir (apenas hierarquia abaixo). Customer não acessa; admin pode tudo. */
function getAllowedRolesToAssign(actorRole: string): string[] {
  switch (actorRole) {
    case 'admin': return ['customer', 'support', 'supervisor', 'manager', 'company_admin', 'admin', 'viewer'];
    case 'company_admin': return ['customer', 'support', 'supervisor', 'manager', 'company_admin', 'viewer'];
    case 'manager': return ['customer', 'support', 'supervisor', 'viewer'];
    case 'supervisor': return ['customer', 'support', 'viewer'];
    case 'support': return ['customer'];
    case 'customer':
    default: return [];
  }
}

export async function getPeopleEndpoint(req: Request, res: Response, storage: IStorage) {
  try {
    const userRole = req.session?.userRole as string;
    if (userRole === 'customer') {
      return res.status(403).json({ message: 'Acesso negado. Clientes não podem acessar esta tela.' });
    }

    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const search = (req.query.search as string) || '';
    const includeInactive = req.query.includeInactive === 'true';
    const filterCompanyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;
    const profileFilter = (req.query.profile as string) || 'all'; // all | requester | official | no_profile

    const sessionCompanyId = req.session?.companyId;

    const allUsers = includeInactive ? await storage.getAllUsers() : await storage.getActiveUsers();

    let filteredUsers = allUsers;
    if (userRole === 'admin') {
      if (filterCompanyId) {
        filteredUsers = allUsers.filter((u) => u.company_id === filterCompanyId);
      }
    } else {
      filteredUsers = allUsers.filter((u) => u.company_id === sessionCompanyId);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.username.toLowerCase().includes(searchLower) ||
          u.role.toLowerCase().includes(searchLower)
      );
    }

    const allFilteredIds = filteredUsers.map((u) => u.id);
    if (allFilteredIds.length === 0) {
      return res.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      });
    }

    const customerRecords = await db
      .select()
      .from(customers)
      .where(inArray(customers.user_id, allFilteredIds));
    const officialRecords = await db
      .select()
      .from(officials)
      .where(inArray(officials.user_id, allFilteredIds));
    const officialIds = officialRecords.map((o) => o.id);

    let deptRows: { official_id: number; department_id: number }[] = [];
    let departmentNames: Record<number, string> = {};
    if (officialIds.length > 0) {
      deptRows = await db
        .select({ official_id: officialDepartments.official_id, department_id: officialDepartments.department_id })
        .from(officialDepartments)
        .where(inArray(officialDepartments.official_id, officialIds));
      const deptIds = [...new Set(deptRows.map((d) => d.department_id))];
      if (deptIds.length > 0) {
        const deptList = await db.select({ id: departments.id, name: departments.name }).from(departments).where(inArray(departments.id, deptIds));
        deptList.forEach((d) => (departmentNames[d.id] = d.name));
      }
    }

    const customerByUserId = new Map(customerRecords.map((c) => [c.user_id!, c]));
    const officialByUserId = new Map(officialRecords.map((o) => [o.user_id!, o]));
    const deptsByOfficialId = new Map<number, string[]>();
    deptRows.forEach((r) => {
      const name = departmentNames[r.department_id];
      if (!name) return;
      if (!deptsByOfficialId.has(r.official_id)) deptsByOfficialId.set(r.official_id, []);
      deptsByOfficialId.get(r.official_id)!.push(name);
    });

    const withProfiles = filteredUsers
      .map((user) => {
        const customer = user.id != null ? customerByUserId.get(user.id) : undefined;
        const official = user.id != null ? officialByUserId.get(user.id) : undefined;
        const isRequester = !!customer;
        const isOfficial = !!official;
        if (profileFilter === 'requester' && !isRequester) return null;
        if (profileFilter === 'official' && !isOfficial) return null;
        if (profileFilter === 'no_profile' && (isRequester || isOfficial)) return null;
        return { user, customer, official, isRequester, isOfficial };
      })
      .filter(Boolean) as { user: typeof filteredUsers[0]; customer: any; official: any; isRequester: boolean; isOfficial: boolean }[];

    const total = withProfiles.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const pageItems = withProfiles.slice(offset, offset + limit);

    const data = pageItems.map(({ user, customer, official, isRequester, isOfficial }) => {
      const { password: _p, ...userWithoutPassword } = user;
      const requesterData = customer
        ? {
            id: customer.id,
            phone: customer.phone ?? undefined,
            company: customer.company ?? undefined,
            sector_id: customer.sector_id ?? undefined,
          }
        : null;
      const officialData = official
        ? {
            id: official.id,
            departments: deptsByOfficialId.get(official.id) || [],
            supervisor_id: official.supervisor_id ?? undefined,
            manager_id: official.manager_id ?? undefined,
          }
        : null;
      return {
        ...userWithoutPassword,
        isRequester,
        isOfficial,
        requesterData,
        officialData,
      };
    });

    res.json({
      data,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error: any) {
    console.error('Erro ao listar people:', error);
    res.status(500).json({ message: 'Falha ao listar usuários', error: error.message || String(error) });
  }
}

function resolveRole(isRequester: boolean, isOfficial: boolean, providedRole: string | undefined): string {
  if (isRequester && isOfficial) return 'support';
  if (isOfficial) return 'support';
  if (isRequester) return 'customer';
  return providedRole || 'viewer';
}

export async function createPersonEndpoint(
  req: Request,
  res: Response,
  storage: IStorage,
  hashPassword: (password: string) => Promise<string>
) {
  try {
    const {
      name,
      email,
      username: rawUsername,
      password,
      role: providedRole,
      company_id: companyIdBody,
      cpf,
      isRequester,
      isOfficial,
      phone,
      company: companyName,
      sector_id,
      departments: departmentsNames,
      supervisor_id,
      manager_id,
      must_change_password,
    } = req.body;

    const username = (rawUsername || email || '').trim();
    const userRole = req.session?.userRole as string;
    const sessionCompanyId = req.session?.companyId;

    if (!name || !email) {
      return res.status(400).json({ message: 'Nome e email são obrigatórios' });
    }
    if (!username) {
      return res.status(400).json({ message: 'Username é obrigatório' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Senha é obrigatória e deve ter no mínimo 6 caracteres' });
    }

    let effectiveCompanyId: number | null = null;
    if (userRole === 'admin') {
      effectiveCompanyId = companyIdBody ?? null;
    } else {
      effectiveCompanyId = sessionCompanyId ?? null;
    }

    const existingByEmail = await storage.getUserByEmail(email);
    if (existingByEmail) {
      return res.status(400).json({ message: 'Email já está em uso' });
    }
    const existingByUsername = await storage.getUserByUsername(username);
    if (existingByUsername) {
      return res.status(400).json({ message: 'Nome de usuário já existe' });
    }

    const reqRole = resolveRole(!!isRequester, !!isOfficial, providedRole);
    const allowedRoles = getAllowedRolesToAssign(userRole);
    if (allowedRoles.length === 0 || !allowedRoles.includes(reqRole)) {
      return res.status(403).json({
        message: 'Você não tem permissão para cadastrar usuários com esse perfil. Só é possível cadastrar cargos da sua hierarquia.',
      });
    }

    const hashedPassword = await hashPassword(password);

    const result = await withTransaction(async () => {
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: reqRole as (typeof schema.userRoleEnum.enumValues)[number],
        company_id: effectiveCompanyId ?? undefined,
        active: true,
        cpf: cpf || undefined,
        must_change_password: must_change_password ?? false,
      });

      let customerRecord: schema.Customer | null = null;
      let officialRecord: schema.Official | null = null;

      if (isRequester) {
        const unlinked = await storage.getCustomerUnlinkedByEmailAndCompany(email, effectiveCompanyId ?? null);
        if (unlinked) {
          customerRecord = (await storage.updateCustomer(unlinked.id, {
            user_id: user.id,
            name,
            email,
            phone: phone || null,
            company: companyName || null,
            company_id: effectiveCompanyId ?? unlinked.company_id ?? undefined,
            sector_id: sector_id ?? undefined,
          })) ?? null;
        } else {
          const existingByEmail = await storage.getCustomerByEmail(email);
          if (existingByEmail) {
            customerRecord = (await storage.updateCustomer(existingByEmail.id, {
              user_id: user.id,
              name,
              email,
              phone: phone || null,
              company: companyName || null,
              company_id: effectiveCompanyId ?? existingByEmail.company_id ?? undefined,
              sector_id: sector_id ?? undefined,
            })) ?? null;
          } else {
            customerRecord = await storage.createCustomer({
              name,
              email,
              phone: phone || null,
              company: companyName || null,
              user_id: user.id,
              company_id: effectiveCompanyId,
              sector_id: sector_id ?? undefined,
            });
          }
        }
      }

      if (isOfficial) {
        const deptArray = Array.isArray(departmentsNames) ? departmentsNames : [];
        const existingOfficialByEmail = await storage.getOfficialByEmail(email);
        if (existingOfficialByEmail) {
          let firstDeptId: number | null = null;
          if (effectiveCompanyId != null && deptArray.length > 0) {
            const firstName = typeof deptArray[0] === 'string' ? deptArray[0] : (deptArray[0] as any)?.department ?? deptArray[0];
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, firstName), eq(departments.company_id, effectiveCompanyId)));
            firstDeptId = d?.id ?? null;
          }
          officialRecord = (await storage.updateOfficial(existingOfficialByEmail.id, {
            user_id: user.id,
            name,
            email,
            is_active: true,
            company_id: effectiveCompanyId ?? existingOfficialByEmail.company_id ?? undefined,
            department_id: firstDeptId ?? existingOfficialByEmail.department_id ?? undefined,
            supervisor_id: supervisor_id ?? existingOfficialByEmail.supervisor_id ?? undefined,
            manager_id: manager_id ?? existingOfficialByEmail.manager_id ?? undefined,
          })) ?? null;
          if (deptArray.length > 0 && effectiveCompanyId != null) {
            await db.delete(officialDepartments).where(eq(officialDepartments.official_id, existingOfficialByEmail.id));
            for (const dept of deptArray) {
              const deptName = typeof dept === 'string' ? dept : (dept as any)?.department;
              if (!deptName) continue;
              const [d] = await db
                .select({ id: departments.id })
                .from(departments)
                .where(and(eq(departments.name, deptName), eq(departments.company_id, effectiveCompanyId)));
              if (d) {
                await storage.addOfficialDepartment({ official_id: existingOfficialByEmail.id, department_id: d.id });
              }
            }
          }
        } else {
          let firstDeptId: number | null = null;
          if (effectiveCompanyId != null && deptArray.length > 0) {
            const firstName = typeof deptArray[0] === 'string' ? deptArray[0] : (deptArray[0] as any)?.department ?? deptArray[0];
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, firstName), eq(departments.company_id, effectiveCompanyId)));
            firstDeptId = d?.id ?? null;
          }
          officialRecord = await storage.createOfficial({
            name,
            email,
            user_id: user.id,
            is_active: true,
            company_id: effectiveCompanyId,
            department_id: firstDeptId ?? undefined,
            supervisor_id: supervisor_id ?? undefined,
            manager_id: manager_id ?? undefined,
          });
          for (const dept of deptArray) {
            const deptName = typeof dept === 'string' ? dept : (dept as any)?.department;
            if (!deptName || !effectiveCompanyId) continue;
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, deptName), eq(departments.company_id, effectiveCompanyId)));
            if (d) {
              await storage.addOfficialDepartment({ official_id: officialRecord!.id, department_id: d.id });
            }
          }
        }
      }

      return { user, customerRecord, officialRecord };
    });

    const { user, customerRecord, officialRecord } = result;
    const { password: _p, ...userWithoutPassword } = user;

    res.status(201).json({
      user: userWithoutPassword,
      isRequester: !!customerRecord,
      isOfficial: !!officialRecord,
      accessInfo: {
        username: user.username,
        temporaryPassword: password,
      },
    });
  } catch (error: any) {
    console.error('Erro ao criar pessoa:', error);
    res.status(500).json({ message: 'Falha ao criar usuário', error: error.message || String(error) });
  }
}

export async function updatePersonEndpoint(
  req: Request,
  res: Response,
  storage: IStorage,
  hashPassword: (password: string) => Promise<string>
) {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const {
      name,
      email,
      username: rawUsername,
      password: newPassword,
      role: providedRole,
      company_id: companyIdBody,
      cpf,
      isRequester,
      isOfficial,
      phone,
      company: companyName,
      sector_id,
      departments: departmentsNames,
      supervisor_id,
      manager_id,
    } = req.body;

    const userRole = req.session?.userRole as string;
    const sessionCompanyId = req.session?.companyId;
    let effectiveCompanyId: number | null = user.company_id ?? null;
    if (userRole === 'admin' && companyIdBody !== undefined) {
      effectiveCompanyId = companyIdBody ?? null;
    } else if (sessionCompanyId != null) {
      effectiveCompanyId = sessionCompanyId;
    }

    const existingCustomer = await storage.getCustomerByUserId(userId);
    const existingOfficial = await storage.getOfficialByUserId(userId);
    const wasRequester = !!existingCustomer;
    const wasOfficial = !!existingOfficial;

    const reqRole = resolveRole(!!isRequester, !!isOfficial, providedRole || user.role);
    const allowedRoles = getAllowedRolesToAssign(userRole);
    if (allowedRoles.length === 0 || !allowedRoles.includes(reqRole)) {
      return res.status(403).json({
        message: 'Você não tem permissão para atribuir esse perfil. Só é possível atribuir cargos da sua hierarquia.',
      });
    }

    await withTransaction(async () => {
      const userUpdate: Partial<schema.User> = {
        name: name ?? user.name,
        email: email ?? user.email,
        username: rawUsername !== undefined ? rawUsername : user.username,
        role: reqRole as (typeof schema.userRoleEnum.enumValues)[number],
        company_id: effectiveCompanyId ?? undefined,
        cpf: cpf !== undefined ? cpf : user.cpf,
      };
      if (newPassword && newPassword.length >= 6) {
        userUpdate.password = await hashPassword(newPassword);
      }
      await storage.updateUser(userId, userUpdate);
    });

    await withTransaction(async () => {
      if (isRequester && !wasRequester) {
        const personEmail = email ?? user.email;
        const unlinked = await storage.getCustomerUnlinkedByEmailAndCompany(personEmail, effectiveCompanyId ?? null);
        if (unlinked) {
          await storage.updateCustomer(unlinked.id, {
            user_id: userId,
            name: name ?? user.name,
            email: personEmail,
            phone: phone !== undefined ? phone : unlinked.phone,
            company: companyName !== undefined ? companyName : unlinked.company,
            company_id: effectiveCompanyId ?? unlinked.company_id ?? undefined,
            sector_id: sector_id !== undefined ? sector_id : unlinked.sector_id ?? undefined,
          });
        } else {
          const existingByEmail = await storage.getCustomerByEmail(personEmail);
          if (existingByEmail) {
            await storage.updateCustomer(existingByEmail.id, {
              user_id: userId,
              name: name ?? user.name,
              email: personEmail,
              phone: phone !== undefined ? phone : existingByEmail.phone,
              company: companyName !== undefined ? companyName : existingByEmail.company,
              company_id: effectiveCompanyId ?? existingByEmail.company_id ?? undefined,
              sector_id: sector_id !== undefined ? sector_id : existingByEmail.sector_id ?? undefined,
            });
          } else {
            await storage.createCustomer({
              name: name ?? user.name,
              email: personEmail,
              phone: phone || null,
              company: companyName || null,
              user_id: userId,
              company_id: effectiveCompanyId,
              sector_id: sector_id ?? undefined,
            });
          }
        }
      } else if (!isRequester && wasRequester && existingCustomer) {
        await storage.updateCustomer(existingCustomer.id, { user_id: null });
      } else if (isRequester && wasRequester && existingCustomer) {
        await storage.updateCustomer(existingCustomer.id, {
          name: name ?? user.name,
          email: email ?? user.email,
          phone: phone !== undefined ? phone : existingCustomer.phone,
          company: companyName !== undefined ? companyName : existingCustomer.company,
          sector_id: sector_id !== undefined ? sector_id : existingCustomer.sector_id ?? undefined,
        });
      }
    });

    await withTransaction(async () => {
      if (isOfficial && !wasOfficial) {
        const personEmail = email ?? user.email;
        const existingOfficialByEmail = await storage.getOfficialByEmail(personEmail);
        if (existingOfficialByEmail) {
          await storage.updateOfficial(existingOfficialByEmail.id, {
            user_id: userId,
            name: name ?? user.name,
            email: personEmail,
            is_active: true,
            company_id: effectiveCompanyId ?? existingOfficialByEmail.company_id ?? undefined,
            department_id: existingOfficialByEmail.department_id ?? undefined,
            supervisor_id: supervisor_id !== undefined ? supervisor_id : existingOfficialByEmail.supervisor_id,
            manager_id: manager_id !== undefined ? manager_id : existingOfficialByEmail.manager_id,
          });
          const deptArray = Array.isArray(departmentsNames) ? departmentsNames : [];
          if (deptArray.length > 0 && effectiveCompanyId != null) {
            await db.delete(officialDepartments).where(eq(officialDepartments.official_id, existingOfficialByEmail.id));
            for (const dept of deptArray) {
              const deptName = typeof dept === 'string' ? dept : (dept as any)?.department;
              if (!deptName) continue;
              const [d] = await db
                .select({ id: departments.id })
                .from(departments)
                .where(and(eq(departments.name, deptName), eq(departments.company_id, effectiveCompanyId)));
              if (d) {
                await storage.addOfficialDepartment({ official_id: existingOfficialByEmail.id, department_id: d.id });
              }
            }
          }
        } else {
          const deptArray = Array.isArray(departmentsNames) ? departmentsNames : [];
          let firstDeptId: number | null = null;
          if (effectiveCompanyId != null && deptArray.length > 0) {
            const firstName = typeof deptArray[0] === 'string' ? deptArray[0] : (deptArray[0] as any)?.department ?? deptArray[0];
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, firstName), eq(departments.company_id, effectiveCompanyId)));
            firstDeptId = d?.id ?? null;
          }
          const official = await storage.createOfficial({
            name: name ?? user.name,
            email: personEmail,
            user_id: userId,
            is_active: true,
            company_id: effectiveCompanyId,
            department_id: firstDeptId ?? undefined,
            supervisor_id: supervisor_id ?? undefined,
            manager_id: manager_id ?? undefined,
          });
          for (const dept of deptArray) {
            const deptName = typeof dept === 'string' ? dept : (dept as any)?.department;
            if (!deptName || !effectiveCompanyId) continue;
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, deptName), eq(departments.company_id, effectiveCompanyId)));
            if (d) {
              await storage.addOfficialDepartment({ official_id: official.id, department_id: d.id });
            }
          }
        }
      } else if (!isOfficial && wasOfficial && existingOfficial) {
        await storage.updateOfficial(existingOfficial.id, { is_active: false });
      } else if (isOfficial && wasOfficial && existingOfficial) {
        await storage.updateOfficial(existingOfficial.id, {
          name: name ?? user.name,
          email: email ?? user.email,
          supervisor_id: supervisor_id !== undefined ? supervisor_id : existingOfficial.supervisor_id,
          manager_id: manager_id !== undefined ? manager_id : existingOfficial.manager_id,
        });
        if (Array.isArray(departmentsNames) && effectiveCompanyId != null) {
          await db.delete(officialDepartments).where(eq(officialDepartments.official_id, existingOfficial.id));
          for (const dept of departmentsNames) {
            const deptName = typeof dept === 'string' ? dept : (dept as any)?.department;
            if (!deptName) continue;
            const [d] = await db
              .select({ id: departments.id })
              .from(departments)
              .where(and(eq(departments.name, deptName), eq(departments.company_id, effectiveCompanyId)));
            if (d) {
              await storage.addOfficialDepartment({ official_id: existingOfficial.id, department_id: d.id });
            }
          }
        }
      }
    });

    const updatedUser = await storage.getUser(userId);
    if (!updatedUser) {
      return res.status(500).json({ message: 'Falha ao recuperar usuário após atualização' });
    }
    const { password: _p, ...userWithoutPassword } = updatedUser;
    const customer = await storage.getCustomerByUserId(userId);
    const official = await storage.getOfficialByUserId(userId);

    res.json({
      user: userWithoutPassword,
      isRequester: !!customer,
      isOfficial: !!official,
      requesterData: customer ? { id: customer.id, phone: customer.phone, company: customer.company, sector_id: customer.sector_id ?? undefined } : null,
      officialData: official ? { id: official.id } : null,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar pessoa:', error);
    res.status(500).json({ message: 'Falha ao atualizar usuário', error: error.message || String(error) });
  }
}
