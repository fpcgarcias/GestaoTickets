import ActiveDirectory from 'activedirectory2';
import { Request, Response, NextFunction } from 'express';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Mostrar as configurações do AD carregadas (sem mostrar a senha)
console.log('======= CONFIGURAÇÕES DO ACTIVE DIRECTORY =======');
console.log(`AD_URL: ${process.env.AD_URL || '(não definido)'}`);
console.log(`AD_BASE_DN: ${process.env.AD_BASE_DN || '(não definido)'}`);
console.log(`AD_USERNAME: ${process.env.AD_USERNAME || '(não definido)'}`);
console.log(`AD_PASSWORD: ${process.env.AD_PASSWORD ? '(definido)' : '(não definido)'}`);
console.log(`AD_DOMAIN: ${process.env.AD_DOMAIN || '(não definido)'}`);
console.log(`AD_ADMIN_GROUP: ${process.env.AD_ADMIN_GROUP || '(não definido, usando padrão: SistemaGestao-Admins)'}`);
console.log(`AD_SUPPORT_GROUP: ${process.env.AD_SUPPORT_GROUP || '(não definido, usando padrão: SistemaGestao-Suporte)'}`);
console.log('===============================================');

// Configurações do Active Directory
const adConfig = {
  url: process.env.AD_URL || 'ldap://seu-servidor-ad.com',
  baseDN: process.env.AD_BASE_DN || 'dc=seu-dominio,dc=com',
  username: process.env.AD_USERNAME || 'usuario@seu-dominio.com',
  password: process.env.AD_PASSWORD || 'senha-admin-ad',
  attributes: {
    user: ['sAMAccountName', 'mail', 'displayName', 'memberOf', 'userPrincipalName', 'proxyAddresses', 'otherMailbox']
  }
};

// Instância do Active Directory
const ad = new ActiveDirectory(adConfig);

/**
 * Autentica um usuário no Active Directory
 * @param username Nome de usuário (sAMAccountName ou userPrincipalName)
 * @param password Senha do usuário
 * @returns Dados do usuário ou null se a autenticação falhar
 */
export async function authenticateAD(username: string, password: string): Promise<any | null> {
  console.log(`[AD Debug] Iniciando autenticação para usuário: ${username}`);
  console.log(`[AD Debug] Configurações AD: URL=${adConfig.url}, baseDN=${adConfig.baseDN}`);
  
  return new Promise((resolve, reject) => {
    // Tratar o nome de usuário para garantir o formato correto
    let formattedUsername = username.trim();
    
    // Se o username contém @, verificar se é o domínio correto
    if (formattedUsername.includes('@')) {
      const domainPart = formattedUsername.split('@')[1];
      
      // Se o domínio não corresponde ao configurado, substituí-lo
      if (process.env.AD_DOMAIN && domainPart !== process.env.AD_DOMAIN) {
        const userPart = formattedUsername.split('@')[0];
        formattedUsername = `${userPart}@${process.env.AD_DOMAIN}`;
        console.log(`[AD Debug] Domínio substituído, novo username: ${formattedUsername}`);
      }
    } 
    // Se o username não contém @, adicionar o domínio
    else if (process.env.AD_DOMAIN) {
      formattedUsername = `${formattedUsername}@${process.env.AD_DOMAIN}`;
      console.log(`[AD Debug] Username formatado com domínio: ${formattedUsername}`);
    }

    console.log(`[AD Debug] Enviando requisição de autenticação para o AD com: ${formattedUsername}`);
    ad.authenticate(formattedUsername, password, (err: Error | null, auth: boolean) => {
      if (err || !auth) {
        console.error('[AD Debug] Erro na autenticação AD:', err);
        console.error(`[AD Debug] Auth result: ${auth}`);
        return resolve(null);
      }
      
      console.log(`[AD Debug] Autenticação bem-sucedida para ${formattedUsername}`);
      
      // Se autenticado, busca informações do usuário
      console.log(`[AD Debug] Buscando informações do usuário no AD...`);
      ad.findUser(formattedUsername, (err: Error | null, user: any) => {
        if (err || !user) {
          console.error('[AD Debug] Erro ao buscar usuário no AD:', err);
          console.error('[AD Debug] Usuário encontrado:', user ? 'Sim' : 'Não');
          return resolve(null);
        }
        
        console.log(`[AD Debug] Usuário encontrado no AD: ${user.displayName || formattedUsername}`);
        console.log(`[AD Debug] Atributos disponíveis: ${Object.keys(user).join(', ')}`);
        
        // Extrair o email do usuário
        let userEmail = '';
        
        // Verificar várias possíveis fontes de email em ordem de prioridade
        if (user.mail && user.mail.trim()) {
          userEmail = user.mail;
          console.log(`[AD Debug] Email encontrado no atributo 'mail': ${userEmail}`);
        } else if (user.userPrincipalName && user.userPrincipalName.includes('@')) {
          userEmail = user.userPrincipalName;
          console.log(`[AD Debug] Email extraído do userPrincipalName: ${userEmail}`);
        } else if (user.proxyAddresses && Array.isArray(user.proxyAddresses) && user.proxyAddresses.length > 0) {
          // Procurar por endereço SMTP primário (começa com "SMTP:")
          const primarySmtp = user.proxyAddresses.find((addr: string) => addr.startsWith('SMTP:'));
          if (primarySmtp) {
            userEmail = primarySmtp.substring(5); // Remove o prefixo "SMTP:"
            console.log(`[AD Debug] Email encontrado em proxyAddresses: ${userEmail}`);
          } else if (user.proxyAddresses[0]) {
            // Usar o primeiro endereço proxy se não houver SMTP primário
            const proxy = user.proxyAddresses[0];
            if (proxy.startsWith('smtp:')) {
              userEmail = proxy.substring(5);
            } else {
              userEmail = proxy;
            }
            console.log(`[AD Debug] Email alternativo de proxyAddresses: ${userEmail}`);
          }
        }
        
        // Verificar se encontramos um email válido
        if (!userEmail || !userEmail.includes('@')) {
          console.error('[AD Debug] Email não encontrado para o usuário ou inválido');
          return resolve({
            error: 'EMAIL_NOT_FOUND',
            message: 'Não foi possível encontrar um endereço de email válido para este usuário no Active Directory.'
          });
        }
        
        // Mapear atributos do AD para o formato esperado pelo sistema
        const adUser = {
          username: user.sAMAccountName || formattedUsername,
          email: userEmail,
          name: user.displayName || formattedUsername,
          adData: user // Dados brutos do AD para referência
        };
        
        console.log(`[AD Debug] Usuário mapeado: ${JSON.stringify(adUser, null, 2)}`);
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
      console.log('[AD Debug] Testando conexão AD com usuário de serviço...');
      
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
              AD_DOMAIN: process.env.AD_DOMAIN ? 'Definido' : 'Não definido'
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
          console.error('[AD Debug] Erro no teste de conexão AD:', err);
          return resolve({ 
            success: false, 
            message: 'Falha na autenticação com a conta de serviço',
            details: { error: err ? err.message : 'Autenticação negada' } 
          });
        }
        
        // Se autenticação funcionou, tentar buscar um usuário para validar a conexão
        ad.findUsers('(objectclass=user)', (err: Error | null, users: any[]) => {
          if (err) {
            console.error('[AD Debug] Erro ao buscar usuários do AD:', err);
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
      console.error('[AD Debug] Erro geral no teste de conexão AD:', error);
      resolve({ 
        success: false, 
        message: 'Erro ao testar conexão com AD',
        details: { error: error instanceof Error ? error.message : String(error) } 
      });
    }
  });
} 