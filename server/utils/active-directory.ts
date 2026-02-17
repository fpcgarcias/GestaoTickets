import { Client } from 'ldapts';
import { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// === VALIDAÇÃO OBRIGATÓRIA DE VARIÁVEIS DE AMBIENTE ===
function validateEnvVariable(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`❌ SEGURANÇA: Variável de ambiente ${name} é obrigatória e não foi definida no arquivo .env`);
  }
  return value;
}

// Configurações do Active Directory
const adConfig = {
  url: validateEnvVariable('AD_URL', process.env.AD_URL),
  baseDN: validateEnvVariable('AD_BASE_DN', process.env.AD_BASE_DN),
  username: validateEnvVariable('AD_USERNAME', process.env.AD_USERNAME),
  password: validateEnvVariable('AD_PASSWORD', process.env.AD_PASSWORD),
  
  attributes: {
    user: ['displayName', 'mail', 'userPrincipalName', 'memberOf', 'proxyAddresses', 'sAMAccountName'],
    group: ['cn', 'description']
  }
};

// Função para criar solicitante LDAP
function createLDAPClient(): Client {
  return new Client({
    url: adConfig.url,
    timeout: 10000 // 10 segundos timeout
  });
}

/**
 * Função auxiliar para corrigir o domínio do email quando necessário
 * @param email Email original
 * @param source Fonte de onde o email foi extraído
 * @returns Email com domínio corrigido, se aplicável
 */
function fixEmailDomain(email: string, _source: string): { email: string, wasFixed: boolean } {
  if (!email || !email.includes('@') || !process.env.AD_EMAIL_DOMAIN) {
    return { email, wasFixed: false };
  }
  
  // Extrair o nome de usuário e o domínio do email
  const parts = email.split('@');
  const userPart = parts[0];
  const domainPart = parts[1];
  
  // Verificar se o domínio parece ser um domínio interno do AD
  if (domainPart && (
      (process.env.AD_DOMAIN && domainPart.toLowerCase() === process.env.AD_DOMAIN.toLowerCase()) ||
      domainPart.toLowerCase().includes('local') ||
      domainPart.toLowerCase().includes('internal') ||
      domainPart.toLowerCase().includes('ad') ||
      domainPart.toLowerCase().includes('corp')
    )) {
    // Substituir o domínio pelo domínio de email configurado
    const fixedEmail = `${userPart}@${process.env.AD_EMAIL_DOMAIN}`;
    return { email: fixedEmail, wasFixed: true };
  }
  
  return { email, wasFixed: false };
}

/**
 * Autentica um usuário no Active Directory
 * @param username Nome de usuário (sAMAccountName ou userPrincipalName)
 * @param password Senha do usuário
 * @returns Dados do usuário ou null se a autenticação falhar
 */
export async function authenticateAD(username: string, password: string): Promise<any | null> {
  const client = createLDAPClient();
  
  try {
    // Tratar o nome de usuário para garantir o formato correto
    let formattedUsername = username.trim();
    
    // Se o username contém @, verificar se é o domínio correto
    if (formattedUsername.includes('@')) {
      const domainPart = formattedUsername.split('@')[1];
      
      // Se o domínio não corresponde ao configurado, substituí-lo
      if (process.env.AD_DOMAIN && domainPart.toLowerCase() !== process.env.AD_DOMAIN.toLowerCase()) {
        const userPart = formattedUsername.split('@')[0];
        formattedUsername = `${userPart}@${process.env.AD_DOMAIN}`;
      }
    } 
    // Se o username não contém @, adicionar o domínio
    else if (process.env.AD_DOMAIN) {
      formattedUsername = `${formattedUsername}@${process.env.AD_DOMAIN}`;
    }

    // Primeiro, fazer bind com as credenciais do usuário para autenticar
    await client.bind(formattedUsername, password);
    
    // Se chegou aqui, a autenticação foi bem-sucedida
    // Agora buscar informações do usuário usando a conta de serviço
    await client.unbind();
    
    // Refazer bind com a conta de serviço para buscar dados do usuário
    await client.bind(adConfig.username, adConfig.password);
    
    // Buscar o usuário pelo sAMAccountName ou userPrincipalName
    const searchFilter = `(|(sAMAccountName=${formattedUsername.split('@')[0]})(userPrincipalName=${formattedUsername}))`;
    const { searchEntries } = await client.search(adConfig.baseDN, {
      scope: 'sub',
      filter: searchFilter,
      attributes: adConfig.attributes.user
    });
    
    if (!searchEntries || searchEntries.length === 0) {
      return null;
    }
    
    const user = searchEntries[0];
    
    // Extrair o email do usuário
    let userEmail = '';
    let emailSource = '';
    
    // Função auxiliar para converter atributos LDAP para string
    const toString = (value: any): string => {
      if (typeof value === 'string') return value;
      if (Buffer.isBuffer(value)) return value.toString('utf8');
      if (Array.isArray(value) && value.length > 0) {
        return toString(value[0]); // Usar o primeiro elemento se for array
      }
      return '';
    };

    // Verificar várias possíveis fontes de email em ordem de prioridade
    const mailValue = toString(user.mail);
    if (mailValue && mailValue.trim()) {
      userEmail = mailValue.trim();
      emailSource = 'mail attribute';
    } else if (user.proxyAddresses && Array.isArray(user.proxyAddresses) && user.proxyAddresses.length > 0) {
      // Procurar por endereço SMTP primário (começa com "SMTP:")
      const proxyAddresses = user.proxyAddresses.map(toString);
      const primarySmtp = proxyAddresses.find((addr: string) => addr.startsWith('SMTP:'));
      if (primarySmtp) {
        userEmail = primarySmtp.substring(5); // Remove o prefixo "SMTP:"
        emailSource = 'proxyAddresses (primary)';
      } else if (proxyAddresses[0]) {
        // Usar o primeiro endereço proxy se não houver SMTP primário
        const proxy = proxyAddresses[0];
        if (proxy.startsWith('smtp:')) {
          userEmail = proxy.substring(5);
        } else {
          userEmail = proxy;
        }
        emailSource = 'proxyAddresses (first)';
      }
    } else {
      const upnValue = toString(user.userPrincipalName);
      if (upnValue && upnValue.includes('@')) {
        userEmail = upnValue;
        emailSource = 'userPrincipalName';
      }
    }
    
    // Verificar se encontramos um email válido
    if (!userEmail || !userEmail.includes('@')) {
      return {
        error: 'EMAIL_NOT_FOUND',
        message: 'Não foi possível encontrar um endereço de email válido para este usuário no Active Directory.'
      };
    }
    
    // Corrigir o domínio do email se necessário
    const { email: correctedEmail, wasFixed: _wasFixed } = fixEmailDomain(userEmail, emailSource);
    userEmail = correctedEmail;
    
    // Mapear atributos do AD para o formato esperado pelo sistema
    const adUser = {
      username: user.sAMAccountName || formattedUsername.split('@')[0],
      email: userEmail,
      name: user.displayName || formattedUsername,
      adData: user // Dados brutos do AD para referência
    };
    
    return adUser;
    
  } catch (_error) {
    // Em caso de erro na autenticação, retornar null
    return null;
  } finally {
    try {
      await client.unbind();
    } catch (_unbindError) {
      // Ignorar erros de unbind
    }
  }
}

/**
 * Verifica se o usuário é membro de um grupo específico no AD
 * @param username Nome de usuário (sAMAccountName ou userPrincipalName)
 * @param groupName Nome do grupo no AD
 * @returns true se o usuário é membro do grupo, false caso contrário
 */
export async function isUserInGroup(username: string, groupName: string): Promise<boolean> {
  const client = createLDAPClient();
  
  try {
    // Fazer bind com a conta de serviço
    await client.bind(adConfig.username, adConfig.password);
    
    // Buscar o usuário
    const userFilter = `(|(sAMAccountName=${username.split('@')[0]})(userPrincipalName=${username}))`;
    const { searchEntries: users } = await client.search(adConfig.baseDN, {
      scope: 'sub',
      filter: userFilter,
      attributes: ['memberOf', 'sAMAccountName', 'userPrincipalName']
    });
    
    if (!users || users.length === 0) {
      return false;
    }
    
    const user = users[0];
    const memberOf = user.memberOf || [];
    
    // Função auxiliar para converter atributos LDAP para string
    const toString = (value: any): string => {
      if (typeof value === 'string') return value;
      if (Buffer.isBuffer(value)) return value.toString('utf8');
      if (Array.isArray(value) && value.length > 0) {
        return toString(value[0]);
      }
      return '';
    };

    // Converter memberOf para array de strings
    const memberOfStrings = Array.isArray(memberOf) 
      ? memberOf.map(toString).filter(Boolean)
      : [toString(memberOf)].filter(Boolean);
    
    // Verificar se o usuário é membro do grupo especificado
    // O memberOf contém DNs dos grupos, então precisamos buscar o grupo pelo nome
    const groupFilter = `(&(objectClass=group)(cn=${groupName}))`;
    const { searchEntries: groups } = await client.search(adConfig.baseDN, {
      scope: 'sub',
      filter: groupFilter,
      attributes: ['dn']
    });
    
    if (!groups || groups.length === 0) {
      return false;
    }
    
    const groupDN = toString(groups[0].dn);
    
    // Verificar se o DN do grupo está na lista memberOf do usuário
    return memberOfStrings.includes(groupDN);
    
  } catch (error) {
    console.error('Erro ao verificar grupo AD:', error);
    return false;
  } finally {
    try {
      await client.unbind();
    } catch (_unbindError) {
      // Ignorar erros de unbind
    }
  }
}

/**
 * Middleware para verificar se o usuário é membro de um grupo específico no AD
 * @param groupName Nome do grupo no AD
 */
export function adGroupRequired(groupName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = req.session as any; // Type assertion para acessar propriedades customizadas
    if (!session?.userId || !session?.adUsername) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    
    isUserInGroup(session.adUsername, groupName)
      .then(isMember => {
        if (isMember) {
          next();
        } else {
          res.status(403).json({ message: 'Permissão negada. Grupo AD necessário.' });
        }
      })
      .catch(err => {
        console.error('Erro ao verificar grupo AD:', err);
        res.status(500).json({ message: 'Erro ao verificar permissões' });
      });
  };
}

/**
 * Testa a conexão com o Active Directory
 * @returns Resultado do teste contendo sucesso e mensagem
 */
export async function testADConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    // Verificar se as configurações básicas estão definidas
    if (!process.env.AD_URL) {
      return { 
        success: false, 
        message: 'AD_URL não definido no arquivo .env',
        details: { 
          configStatus: {
            AD_URL: process.env.AD_URL ? 'Definido' : 'Não definido',
            AD_BASE_DN: process.env.AD_BASE_DN ? 'Definido' : 'Não definido',
            AD_USERNAME: process.env.AD_USERNAME ? 'Definido' : 'Não definido',
            AD_PASSWORD: process.env.AD_PASSWORD ? 'Definido' : 'Não definido',
            AD_DOMAIN: process.env.AD_DOMAIN ? 'Definido' : 'Não definido',
            AD_EMAIL_DOMAIN: process.env.AD_EMAIL_DOMAIN ? 'Definido' : 'Não definido'
          } 
        }
      };
    }
    
    // Tentar autenticar usando a conta de serviço
    if (!process.env.AD_USERNAME || !process.env.AD_PASSWORD) {
      return { 
        success: false, 
        message: 'Credenciais da conta de serviço (AD_USERNAME ou AD_PASSWORD) não definidas' 
      };
    }
    
    const client = createLDAPClient();
    
    try {
      // Testar autenticação com a conta de serviço
      await client.bind(adConfig.username, adConfig.password);
      
      // Se autenticação funcionou, tentar buscar usuários para validar a conexão
      const { searchEntries: users } = await client.search(adConfig.baseDN, {
        scope: 'sub',
        filter: '(objectClass=user)',
        attributes: ['displayName', 'sAMAccountName'],
        sizeLimit: 10 // Limitar a 10 usuários para teste
      });
      
      // Verificar se há resultados
      if (!users || users.length === 0) {
        return { 
          success: true, 
          message: 'Conexão bem-sucedida, mas nenhum usuário encontrado com o filtro definido',
          details: { users } 
        };
      }
      
      return { 
        success: true, 
        message: 'Conexão AD estabelecida com sucesso e usuários encontrados',
        details: { 
          usersFound: users.length,
          sampleUser: users[0].displayName || users[0].sAMAccountName || 'Nome não disponível'
        } 
      };
      
    } catch (bindError) {
      return { 
        success: false, 
        message: 'Falha na autenticação com a conta de serviço',
        details: { error: bindError instanceof Error ? bindError.message : String(bindError) } 
      };
    } finally {
      try {
        await client.unbind();
      } catch (_unbindError) {
        // Ignorar erros de unbind
      }
    }
    
  } catch (error) {
    return { 
      success: false, 
      message: 'Erro ao testar conexão com AD',
      details: { error: error instanceof Error ? error.message : String(error) } 
    };
  }
} 