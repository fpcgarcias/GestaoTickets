# Configuração do Active Directory

Este documento explica como configurar a autenticação via Active Directory para o domínio `suporte.vixbrasil.com`.

## 🔧 Configuração do .env

Adicione as seguintes variáveis ao seu arquivo `.env`:

```bash
# Configurações do Active Directory para autenticação via AD
# Essas configurações são obrigatórias quando o login via AD está habilitado

# URL do servidor Active Directory (LDAP://servidor:porta)
AD_URL=ldap://dc-sc01.vixbrasil.local

# Base DN para pesquisas no AD
AD_BASE_DN=dc=vixbrasil,dc=local

# Credenciais da conta de serviço para conexão com o AD
AD_USERNAME=super@vixbrasil.local
AD_PASSWORD=Almox123@!

# Domínio do Active Directory
AD_DOMAIN=vixbrasil.local

# Domínio de email para correção automática de emails
AD_EMAIL_DOMAIN=vixbrasil.com

# Mapeamento de grupos do Active Directory para roles do sistema
# Grupos do Active Directory para cada role do sistema

# Grupos de administração
AD_ADMIN_GROUP=SistemaGestao-Admins
AD_COMPANY_ADMIN_GROUP=SistemaGestao-CompanyAdmin

# Grupos de gerenciamento  
AD_MANAGER_GROUP=SistemaGestao-Managers
AD_SUPERVISOR_GROUP=SistemaGestao-Supervisors

# Grupos de suporte
AD_SUPPORT_GROUP=SistemaGestao-Support
AD_TRIAGE_GROUP=SistemaGestao-Triage
AD_QUALITY_GROUP=SistemaGestao-Quality

# Grupos de visualização
AD_VIEWER_GROUP=SistemaGestao-Viewers

# Grupos de clientes
AD_CUSTOMER_GROUP=SistemaGestao-Customers

# Grupos especiais
AD_INTEGRATION_BOT_GROUP=SistemaGestao-Bots
```

## 🎯 Como Funciona

### 1. Detecção de Domínio
O sistema detecta automaticamente quando uma requisição vem do domínio `suporte.vixbrasil.com` e habilita a autenticação via AD.

### 2. Processo de Autenticação
1. **Detecção**: Sistema verifica se o domínio está configurado para usar AD
2. **Autenticação**: Credenciais são validadas no Active Directory
3. **Mapeamento**: Grupos do usuário no AD são mapeados para roles do sistema
4. **Login**: Usuário é logado com o role apropriado

### 3. Mapeamento de Roles
Os usuários são mapeados para roles baseado nos grupos do AD, seguindo esta ordem de prioridade:

1. **admin** → `SistemaGestao-Admins`
2. **company_admin** → `SistemaGestao-CompanyAdmin`
3. **manager** → `SistemaGestao-Managers`
4. **supervisor** → `SistemaGestao-Supervisors`
5. **support** → `SistemaGestao-Support`
6. **triage** → `SistemaGestao-Triage`
7. **quality** → `SistemaGestao-Quality`
8. **viewer** → `SistemaGestao-Viewers`
9. **integration_bot** → `SistemaGestao-Bots`
10. **customer** → `SistemaGestao-Customers` (role padrão)

## 🔍 Endpoints de Teste

### 1. Testar Conexão com AD
```bash
GET /api/auth/test-ad
```
Testa a conectividade básica com o servidor AD.

### 2. Testar Autenticação de Usuário
```bash
POST /api/auth/test-ad-user
Content-Type: application/json

{
  "username": "usuario.teste",
  "password": "senha123"
}
```
Testa autenticação de um usuário específico e mostra os grupos e role mapeado.

### 3. Verificar Configuração de Grupos
```bash
GET /api/auth/ad-groups-config
```
Mostra a configuração atual dos grupos e validações (requer admin).

### 4. Verificar Configuração de Domínio
```bash
POST /api/auth/check-domain-ad
Content-Type: application/json

{
  "domain": "suporte.vixbrasil.com"
}
```
Verifica se um domínio específico está configurado para usar AD.

## 🚀 Implementação Concluída

### ✅ O que foi implementado:

1. **Middleware de Detecção de Domínio** (`server/middleware/domain-detection.ts`)
   - Detecta automaticamente domínios que devem usar AD
   - Suporta `suporte.vixbrasil.com`, `sistema.vixbrasil.com`, `vixbrasil.com`

2. **Serviço de Mapeamento de Roles** (`server/services/ad-role-mapping.ts`)
   - Mapeia grupos do AD para roles do sistema
   - Suporta todos os roles: admin, company_admin, manager, supervisor, support, triage, customer, viewer, quality, integration_bot
   - Configurável via variáveis de ambiente

3. **Login Híbrido** (modificação em `server/routes.ts`)
   - Detecta automaticamente o domínio da requisição
   - Usa AD para domínios configurados (`suporte.vixbrasil.com`)
   - Mantém autenticação tradicional para outros domínios

4. **Endpoints de Teste e Configuração**
   - Teste de conexão AD
   - Teste de autenticação de usuário
   - Verificação de configuração de grupos
   - Verificação de configuração de domínio

### 🔧 Configuração Necessária:

1. **Grupos no Active Directory**: Criar os grupos listados acima no AD
2. **Usuários nos Grupos**: Adicionar usuários aos grupos apropriados
3. **Variáveis de Ambiente**: Configurar todas as variáveis listadas no .env
4. **Usuários no Sistema**: Usuários devem existir no banco de dados do sistema (ou implementar criação automática)

## ⚠️ Observações Importantes

1. **Segurança**: A conta de serviço do AD deve ter apenas permissões de leitura
2. **Fallback**: Se a autenticação AD falhar, o sistema não tenta autenticação tradicional
3. **Usuários Existentes**: Usuários AD devem estar previamente cadastrados no sistema
4. **Prioridade de Roles**: Se um usuário pertencer a múltiplos grupos, será usado o de maior prioridade
5. **Role Padrão**: Usuários sem grupo específico recebem role 'customer'

## 🔄 Próximos Passos Opcionais

1. **Criação Automática de Usuários**: Implementar criação automática de usuários AD no sistema
2. **Sincronização de Dados**: Atualizar dados do usuário no banco com informações do AD
3. **Cache de Grupos**: Implementar cache para evitar consultas repetidas ao AD
4. **Logs de Auditoria**: Adicionar logs detalhados de autenticações AD 