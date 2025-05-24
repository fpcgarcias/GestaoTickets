import ActiveDirectory from 'activedirectory2';
import { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Configurações do Active Directory
const adConfig = {
  url: process.env.AD_URL || 'ldap://127.0.0.1:389',
  baseDN: process.env.AD_BASE_DN || 'DC=vixbrasil,DC=local',
  username: process.env.AD_USERNAME || 'VIXBRASIL\\administrador',
  password: process.env.AD_PASSWORD || 'senha-admin-ad',
  
  attributes: {
    user: ['displayName', 'mail', 'userPrincipalName', 'memberOf', 'proxyAddresses'],
    group: ['cn', 'description']
  }
};

// Instância do Active Directory
const ad = new ActiveDirectory(adConfig);

/**
 * Função auxiliar para corrigir o domínio do email quando necessário
 * @param email Email original
 * @param source Fonte de onde o email foi extraído
 * @returns Email com domínio corrigido, se aplicável
 */
function fixEmailDomain(email: string, source: string): { email: string, wasFixed: boolean } {
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
  return new Promise((resolve, reject) => {
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

    ad.authenticate(formattedUsername, password, (err: Error | null, auth: boolean) => {
      if (err || !auth) {
        return resolve(null);
      }
      
      // Se autenticado, busca informações do usuário
      ad.findUser(formattedUsername, (err: Error | null, user: any) => {
        if (err || !user) {
          return resolve(null);
        }
        
        // Extrair o email do usuário
        let userEmail = '';
        let emailSource = '';
        
        // Verificar várias possíveis fontes de email em ordem de prioridade
        if (user.mail && user.mail.trim()) {
          userEmail = user.mail.trim();
          emailSource = 'mail attribute';
        } else if (user.proxyAddresses && Array.isArray(user.proxyAddresses) && user.proxyAddresses.length > 0) {
          // Procurar por endereço SMTP primário (começa com "SMTP:")
          const primarySmtp = user.proxyAddresses.find((addr: string) => addr.startsWith('SMTP:'));
          if (primarySmtp) {
            userEmail = primarySmtp.substring(5); // Remove o prefixo "SMTP:"
            emailSource = 'proxyAddresses (primary)';
          } else if (user.proxyAddresses[0]) {
            // Usar o primeiro endereço proxy se não houver SMTP primário
            const proxy = user.proxyAddresses[0];
            if (proxy.startsWith('smtp:')) {
              userEmail = proxy.substring(5);
            } else {
              userEmail = proxy;
            }
            emailSource = 'proxyAddresses (first)';
          }
        } else if (user.userPrincipalName && user.userPrincipalName.includes('@')) {
          userEmail = user.userPrincipalName;
          emailSource = 'userPrincipalName';
        }
        
        // Verificar se encontramos um email válido
        if (!userEmail || !userEmail.includes('@')) {
          return resolve({
            error: 'EMAIL_NOT_FOUND',
            message: 'Não foi possível encontrar um endereço de email válido para este usuário no Active Directory.'
          });
        }
        
        // Corrigir o domínio do email se necessário
        const { email: correctedEmail, wasFixed } = fixEmailDomain(userEmail, emailSource);
        userEmail = correctedEmail;
        
        // Mapear atributos do AD para o formato esperado pelo sistema
        const adUser = {
          username: user.sAMAccountName || formattedUsername.split('@')[0],
          email: userEmail,
          name: user.displayName || formattedUsername,
          adData: user // Dados brutos do AD para referência
        };
        
        resolve(adUser);
      });
    });
  });
}

/**
 * Verifica se o usuário é membro de um grupo específico no AD
 * @param username Nome de usuário (sAMAccountName ou userPrincipalName)
 * @param groupName Nome do grupo no AD
 * @returns true se o usuário é membro do grupo, false caso contrário
 */
export async function isUserInGroup(username: string, groupName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    ad.isUserMemberOf(username, groupName, (err: Error | null, isMember: boolean) => {
      if (err) {
        console.error('Erro ao verificar grupo AD:', err);
        return resolve(false);
      }
      resolve(isMember);
    });
  });
}

/**
 * Middleware para verificar se o usuário é membro de um grupo específico no AD
 * @param groupName Nome do grupo no AD
 */
export function adGroupRequired(groupName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId || !req.session?.adUsername) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    
    isUserInGroup(req.session.adUsername, groupName)
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
  return new Promise((resolve) => {
    try {
      // Verificar se as configurações básicas estão definidas
      if (!process.env.AD_URL) {
        return resolve({ 
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
        });
      }
      
      // Tentar autenticar usando a conta de serviço
      if (!process.env.AD_USERNAME || !process.env.AD_PASSWORD) {
        return resolve({ 
          success: false, 
          message: 'Credenciais da conta de serviço (AD_USERNAME ou AD_PASSWORD) não definidas' 
        });
      }
      
      // Testar autenticação com a conta de serviço
      ad.authenticate(process.env.AD_USERNAME, process.env.AD_PASSWORD, (err: Error | null, auth: boolean) => {
        if (err || !auth) {
          return resolve({ 
            success: false, 
            message: 'Falha na autenticação com a conta de serviço',
            details: { error: err ? err.message : 'Autenticação negada' } 
          });
        }
        
        // Se autenticação funcionou, tentar buscar um usuário para validar a conexão
        ad.findUsers('(objectclass=user)', (err: Error | null, users: any[]) => {
          if (err) {
            return resolve({ 
              success: false, 
              message: 'Autenticação bem-sucedida, mas falha ao buscar usuários do AD',
              details: { error: err.message } 
            });
          }
          
          // Verificar se há resultados
          if (!users || users.length === 0) {
            return resolve({ 
              success: true, 
              message: 'Conexão bem-sucedida, mas nenhum usuário encontrado com o filtro definido',
              details: { users } 
            });
          }
          
          resolve({ 
            success: true, 
            message: 'Conexão AD estabelecida com sucesso e usuários encontrados',
            details: { 
              usersFound: users.length,
              sampleUser: users[0].displayName || 'Nome não disponível'
            } 
          });
        });
      });
    } catch (error) {
      resolve({ 
        success: false, 
        message: 'Erro ao testar conexão com AD',
        details: { error: error instanceof Error ? error.message : String(error) } 
      });
    }
  });
} 