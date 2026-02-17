# Análise: Migração para Microsoft Entra ID (Multi-Tenant)

## 1. Situação Atual

### 1.1 Autenticação LDAP/AD Local

O sistema atualmente possui uma integração com Active Directory via LDAP (`server/utils/active-directory.ts`) que:

- Depende de **variáveis de ambiente fixas** (`AD_URL`, `AD_BASE_DN`, `AD_USERNAME`, `AD_PASSWORD`, `AD_DOMAIN`)
- Funciona apenas com **um único servidor LDAP local** (on-premises)
- Requer que o servidor do sistema tenha **acesso de rede direto** ao controlador de domínio
- **Não está integrada ao fluxo de login principal** — o código existe mas o login usa apenas bcrypt local
- Suporta apenas **um tenant por instalação**

### 1.2 Autenticação Local Atual

- Login via `POST /api/auth/login` com `username` + `password`
- Senha verificada com **bcrypt** localmente
- Sessão armazenada no **PostgreSQL** (`user_sessions`) via `express-session`
- Sessão contém: `userId`, `userRole`, `companyId`
- Já existe um campo `ad_user: boolean` na tabela `users` (não utilizado no fluxo)

### 1.3 Multi-Tenancy Existente

O sistema **já possui** uma estrutura multi-tenant baseada em `companies`:
- Tabela `companies` funciona como container de tenant
- `users.company_id` vincula usuário à empresa
- Middleware `companyAccessRequired` isola dados por empresa
- `admin` tem acesso global; `company_admin` gerencia sua empresa

---

## 2. O que é o Microsoft Entra ID?

O **Microsoft Entra ID** (antigo Azure Active Directory / Azure AD) é o serviço de identidade na nuvem da Microsoft. Diferente do AD local (LDAP), ele usa protocolos modernos:

| Aspecto | AD Local (LDAP) | Microsoft Entra ID |
|---|---|---|
| Protocolo | LDAP (porta 389/636) | **OAuth 2.0 / OpenID Connect** (HTTPS) |
| Acesso | Rede interna obrigatória | **Internet** (qualquer lugar) |
| Autenticação | Bind LDAP com senha | **Redirect para login Microsoft** |
| Multi-tenant | Um servidor por cliente | **Um App Registration para vários tenants** |
| MFA | Requer solução separada | **Nativo** (Authenticator, SMS, etc.) |
| SSO | Complexo (Kerberos/NTLM) | **Nativo** |

---

## 3. Como Funcionaria a Autenticação Multi-Tenant

### 3.1 Fluxo de Autenticação (Authorization Code Flow com PKCE)

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│ Usuário  │     │ Frontend     │     │ Backend (API)    │     │ Entra ID │
│ (Browser)│     │ (React SPA)  │     │ (Express)        │     │(Microsoft)│
└────┬─────┘     └──────┬───────┘     └────────┬─────────┘     └─────┬────┘
     │                  │                      │                     │
     │ 1. Clica "Entrar │                      │                     │
     │    com Microsoft" │                      │                     │
     │ ─────────────────>│                      │                     │
     │                  │                      │                     │
     │                  │ 2. GET /api/auth/     │                     │
     │                  │    entra/login?       │                     │
     │                  │    company=slug       │                     │
     │                  │ ────────────────────> │                     │
     │                  │                      │                     │
     │                  │                      │ 3. Busca config do   │
     │                  │                      │    tenant no BD      │
     │                  │                      │                     │
     │                  │ 4. Redirect 302      │                     │
     │ <────────────────────────────────────── │                     │
     │                  │                      │                     │
     │ 5. Login na tela da Microsoft ─────────────────────────────>  │
     │    (email + senha + MFA)                │                     │
     │                  │                      │                     │
     │ 6. Redirect com authorization_code  <─────────────────────── │
     │ ──────────────────────────────────────> │                     │
     │                  │                      │                     │
     │                  │                      │ 7. Troca code por    │
     │                  │                      │    tokens            │
     │                  │                      │ ───────────────────> │
     │                  │                      │                     │
     │                  │                      │ 8. Recebe:           │
     │                  │                      │    - access_token    │
     │                  │                      │    - id_token        │
     │                  │                      │    - refresh_token   │
     │                  │                      │ <─────────────────── │
     │                  │                      │                     │
     │                  │                      │ 9. Valida id_token,  │
     │                  │                      │    extrai claims:    │
     │                  │                      │    - oid (object id) │
     │                  │                      │    - tid (tenant id) │
     │                  │                      │    - email           │
     │                  │                      │    - name            │
     │                  │                      │    - preferred_user  │
     │                  │                      │                     │
     │                  │                      │ 10. Cria/atualiza    │
     │                  │                      │     usuário no BD    │
     │                  │                      │                     │
     │                  │                      │ 11. Cria sessão      │
     │                  │                      │     express-session  │
     │                  │                      │                     │
     │                  │ 12. Redirect para app │                     │
     │ <────────────────────────────────────── │                     │
     │                  │                      │                     │
     │  13. App carrega │                      │                     │
     │      com sessão  │                      │                     │
     └─────────────────>│                      │                     │
```

### 3.2 Identificação do Tenant

Cada empresa (tenant) do Entra ID tem um **Tenant ID** único (GUID). Quando o usuário faz login, o `id_token` contém a claim `tid` que identifica de qual tenant ele veio. Isso permite mapear automaticamente para a `company` correta no sistema.

---

## 4. O que Precisamos no Azure Portal

### 4.1 App Registration (Uma Única para Todo o Sistema)

No Azure Portal, precisamos criar **um único App Registration** configurado como **multi-tenant**:

| Configuração | Valor |
|---|---|
| **Nome** | GestaoTickets |
| **Supported Account Types** | "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)" |
| **Redirect URI (Web)** | `https://seudominio.com/api/auth/entra/callback` |
| **Platform** | Web |

### 4.2 Credenciais Geradas pelo Azure

Após criar o App Registration, o Azure gera:

| Credencial | Descrição | Onde guardar |
|---|---|---|
| **Application (client) ID** | Identificador único do app | Variável de ambiente `ENTRA_CLIENT_ID` |
| **Client Secret** | Segredo para trocar code por tokens | Variável de ambiente `ENTRA_CLIENT_SECRET` |
| **Directory (tenant) ID** | ID do tenant principal (não usado em multi-tenant) | Não necessário |

### 4.3 Permissões (API Permissions)

| Permissão | Tipo | Motivo |
|---|---|---|
| `openid` | Delegated | Autenticação OpenID Connect |
| `profile` | Delegated | Nome e dados do perfil |
| `email` | Delegated | Endereço de email |
| `User.Read` | Delegated | Ler perfil do usuário logado |
| `offline_access` | Delegated | Obter refresh_token (para renovação) |

> **Nota:** Todas as permissões acima são "Delegated" e **não requerem Admin Consent** do tenant do cliente. Isso significa que cada cliente pode usar o app sem que um admin do Entra ID dele precise aprovar explicitamente.

### 4.4 O que Cada Cliente Precisa Fazer

Para cada empresa cliente que quiser usar o Entra ID:

1. **Nada no Azure** — O fluxo multi-tenant já permite login de qualquer tenant
2. **No sistema GestaoTickets** — O `company_admin` configura o **Tenant ID** da empresa na tela de configurações
3. **Opcional** — O admin do Entra ID do cliente pode restringir quais usuários podem acessar o app via "Enterprise Applications"

---

## 5. Alterações no Banco de Dados

### 5.1 Nova Tabela: `entra_id_configs` (Configuração por Empresa)

Armazena a configuração do Entra ID para cada empresa/tenant.

```sql
CREATE TABLE entra_id_configs (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Identificação do Tenant Microsoft
    tenant_id       TEXT NOT NULL,           -- GUID do tenant Entra ID (ex: "a1b2c3d4-...")
    
    -- Configurações opcionais
    enabled         BOOLEAN DEFAULT true,    -- Se SSO está ativo para esta empresa
    auto_provision  BOOLEAN DEFAULT true,    -- Criar usuário automaticamente no 1º login?
    default_role    TEXT DEFAULT 'customer',  -- Role padrão para novos usuários via SSO
    
    -- Domínios de email permitidos (para validação extra)
    allowed_domains TEXT[],                  -- Ex: ["empresa.com.br", "empresa.com"]
    
    -- Metadados
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(company_id),        -- Uma config por empresa
    UNIQUE(tenant_id)          -- Um tenant por empresa (evita duplicatas)
);
```

**Campos e seus propósitos:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `company_id` | `INTEGER` | Sim | Vincula a configuração à empresa existente no sistema |
| `tenant_id` | `TEXT` | Sim | GUID do tenant Microsoft Entra ID. É o que identifica "de qual empresa Microsoft esse usuário veio". Extraído da claim `tid` do token |
| `enabled` | `BOOLEAN` | Não | Permite desativar SSO sem remover a configuração |
| `auto_provision` | `BOOLEAN` | Não | Se `true`, cria automaticamente o usuário no sistema quando ele faz login pela primeira vez via Entra ID |
| `default_role` | `TEXT` | Não | Qual `role` atribuir a usuários auto-provisionados (geralmente `customer`) |
| `allowed_domains` | `TEXT[]` | Não | Lista de domínios de email permitidos. Se preenchida, apenas emails desses domínios podem logar. Previne que convidados (guests) do tenant acessem |
| `created_at` | `TIMESTAMP` | Auto | Data de criação |
| `updated_at` | `TIMESTAMP` | Auto | Data da última atualização |

### 5.2 Nova Tabela: `entra_id_users` (Vínculo Usuário ↔ Entra ID)

Mapeia cada usuário do sistema ao seu perfil no Entra ID. Um usuário pode ter vínculos com diferentes tenants se necessário.

```sql
CREATE TABLE entra_id_users (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identificadores do Entra ID
    entra_object_id   TEXT NOT NULL,          -- OID (Object ID) do usuário no Entra ID
    entra_tenant_id   TEXT NOT NULL,          -- Tenant ID de onde o usuário veio
    entra_upn         TEXT,                   -- UserPrincipalName (ex: joao@empresa.com)
    
    -- Tokens (criptografados)
    refresh_token     TEXT,                   -- Refresh token (criptografado) para renovação
    token_expires_at  TIMESTAMP,             -- Quando o access_token atual expira
    
    -- Dados do perfil sincronizados
    entra_display_name TEXT,                  -- Nome exibido no Entra ID
    entra_email        TEXT,                  -- Email do Entra ID
    entra_job_title    TEXT,                  -- Cargo no Entra ID
    entra_department   TEXT,                  -- Departamento no Entra ID
    
    -- Controle
    last_login_at     TIMESTAMP,             -- Último login via Entra ID
    is_active         BOOLEAN DEFAULT true,  -- Se o vínculo está ativo
    
    -- Metadados
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(entra_object_id, entra_tenant_id),  -- Um vínculo por OID+tenant
    UNIQUE(user_id, entra_tenant_id)           -- Um vínculo por user+tenant
);

-- Índices para buscas rápidas no login
CREATE INDEX idx_entra_users_oid ON entra_id_users(entra_object_id, entra_tenant_id);
CREATE INDEX idx_entra_users_user ON entra_id_users(user_id);
```

**Campos e seus propósitos:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `user_id` | `INTEGER` | Sim | FK para a tabela `users` existente |
| `entra_object_id` | `TEXT` | Sim | Identificador único e imutável do usuário no Entra ID (claim `oid`). Diferente do email, nunca muda |
| `entra_tenant_id` | `TEXT` | Sim | De qual tenant Microsoft esse vínculo veio |
| `entra_upn` | `TEXT` | Não | UserPrincipalName (geralmente email corporativo). Pode mudar se o usuário for renomeado |
| `refresh_token` | `TEXT` | Não | Token para renovar o `access_token` sem pedir login novamente. **Deve ser criptografado** (AES-256-GCM) |
| `token_expires_at` | `TIMESTAMP` | Não | Quando o access_token expira (para saber quando renovar) |
| `entra_display_name` | `TEXT` | Não | Nome sincronizado do Entra ID |
| `entra_email` | `TEXT` | Não | Email sincronizado do Entra ID |
| `entra_job_title` | `TEXT` | Não | Cargo — pode ser útil para auto-classificar roles |
| `entra_department` | `TEXT` | Não | Departamento — pode ser usado para auto-vincular a departments |
| `last_login_at` | `TIMESTAMP` | Não | Registro de auditoria do último login SSO |
| `is_active` | `BOOLEAN` | Não | Permite desativar o vínculo sem deletar (ex: usuário saiu da empresa) |

### 5.3 Alterações na Tabela `users` Existente

Pequenas mudanças na tabela `users`:

```sql
-- Tornar password opcional (usuários SSO não têm senha local)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Novo campo para indicar o método de autenticação
ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'local';
-- Valores possíveis: 'local', 'entra_id', 'both'

-- O campo ad_user existente pode ser mantido para compatibilidade
-- ou substituído pelo auth_method
```

| Campo | Mudança | Motivo |
|---|---|---|
| `password` | Tornar **nullable** | Usuários que entram só via Entra ID não terão senha local |
| `auth_method` | **Novo campo** | Indica se o usuário usa autenticação local, Entra ID, ou ambas |

### 5.4 Nova Tabela: `entra_id_login_logs` (Auditoria - Opcional)

Para rastreabilidade e troubleshooting:

```sql
CREATE TABLE entra_id_login_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    entra_tenant_id TEXT NOT NULL,
    entra_object_id TEXT,
    entra_upn       TEXT,
    ip_address      TEXT,
    user_agent      TEXT,
    success         BOOLEAN NOT NULL,
    error_message   TEXT,                    -- Se falhou, qual foi o erro
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entra_login_logs_user ON entra_id_login_logs(user_id);
CREATE INDEX idx_entra_login_logs_date ON entra_id_login_logs(created_at);
```

---

## 6. Schema Drizzle (Para o Projeto)

Tradução das tabelas acima para o schema Drizzle existente em `shared/schema.ts`:

```typescript
// === ENTRA ID (Microsoft SSO) ===

export const entraIdConfigs = pgTable("entra_id_configs", {
  id: serial("id").primaryKey(),
  company_id: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  tenant_id: text("tenant_id").notNull(),
  enabled: boolean("enabled").default(true),
  auto_provision: boolean("auto_provision").default(true),
  default_role: text("default_role").default("customer"),
  allowed_domains: text("allowed_domains").array(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueCompany: unique().on(table.company_id),
  uniqueTenant: unique().on(table.tenant_id),
}));

export const entraIdUsers = pgTable("entra_id_users", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entra_object_id: text("entra_object_id").notNull(),
  entra_tenant_id: text("entra_tenant_id").notNull(),
  entra_upn: text("entra_upn"),
  refresh_token: text("refresh_token"),
  token_expires_at: timestamp("token_expires_at"),
  entra_display_name: text("entra_display_name"),
  entra_email: text("entra_email"),
  entra_job_title: text("entra_job_title"),
  entra_department: text("entra_department"),
  last_login_at: timestamp("last_login_at"),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueOidTenant: unique().on(table.entra_object_id, table.entra_tenant_id),
  uniqueUserTenant: unique().on(table.user_id, table.entra_tenant_id),
}));

export const entraIdLoginLogs = pgTable("entra_id_login_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  entra_tenant_id: text("entra_tenant_id").notNull(),
  entra_object_id: text("entra_object_id"),
  entra_upn: text("entra_upn"),
  ip_address: text("ip_address"),
  user_agent: text("user_agent"),
  success: boolean("success").notNull(),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow(),
});
```

---

## 7. Variáveis de Ambiente Necessárias

```env
# === Microsoft Entra ID (Global — do App Registration) ===
ENTRA_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ENTRA_REDIRECT_URI=https://seudominio.com/api/auth/entra/callback

# === Segurança de Tokens ===
ENTRA_TOKEN_ENCRYPTION_KEY=chave-de-32-bytes-para-aes-256-gcm
```

> **Importante:** `ENTRA_CLIENT_ID` e `ENTRA_CLIENT_SECRET` são **globais** (do app registration). O `tenant_id` de cada empresa vem do banco de dados, **não** de variável de ambiente.

---

## 8. Bibliotecas/Dependências Necessárias

| Pacote | Versão | Propósito |
|---|---|---|
| `@azure/msal-node` | ^2.x | Biblioteca oficial da Microsoft para auth OAuth2/OIDC |
| `jsonwebtoken` | ^9.x | Validação e decodificação de id_tokens JWT |
| `jwks-rsa` | ^3.x | Busca as chaves públicas (JWKS) do Entra ID para validar tokens |

**Ou alternativa mais leve:**

| Pacote | Versão | Propósito |
|---|---|---|
| `openid-client` | ^6.x | Cliente OpenID Connect genérico (mais leve que MSAL) |

> **Recomendação:** Para um backend Express, `openid-client` costuma ser mais simples e direto que `@azure/msal-node`, que é mais voltado para apps Node.js com frontend integrado.

---

## 9. Endpoints Novos Necessários

### 9.1 Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/auth/entra/login` | Inicia o fluxo OAuth — redireciona o usuário para o login Microsoft |
| `GET` | `/api/auth/entra/callback` | Recebe o `authorization_code` da Microsoft e completa o login |
| `POST` | `/api/auth/entra/refresh` | Renova o `access_token` usando o `refresh_token` |
| `GET` | `/api/auth/entra/status` | Verifica se o usuário atual está vinculado ao Entra ID |

### 9.2 Administração (Company Admin / Admin)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/entra/config` | Retorna a configuração Entra ID da empresa do usuário logado |
| `POST` | `/api/entra/config` | Cria/atualiza a configuração do Entra ID (tenant_id, domínios, etc.) |
| `DELETE` | `/api/entra/config` | Remove a configuração do Entra ID da empresa |
| `POST` | `/api/entra/test` | Testa a conexão com o tenant configurado |
| `GET` | `/api/entra/users` | Lista os usuários vinculados ao Entra ID na empresa |
| `POST` | `/api/entra/users/:userId/link` | Vincula manualmente um usuário existente ao Entra ID |
| `DELETE` | `/api/entra/users/:userId/unlink` | Remove o vínculo de um usuário com o Entra ID |

---

## 10. Fluxo Detalhado do Login SSO

### 10.1 Primeiro Login (Auto-Provisioning)

```
1. Usuário acessa o sistema e clica "Entrar com Microsoft"
2. Frontend envia para: GET /api/auth/entra/login?company=slug-da-empresa
3. Backend busca entra_id_configs onde company.slug = slug-da-empresa
4. Backend monta a URL de autorização:
   - https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize
   - Params: client_id, redirect_uri, scope, response_type=code, state, code_challenge (PKCE)
5. Redirect 302 para o login da Microsoft
6. Usuário faz login (email + senha + MFA)
7. Microsoft redireciona para: GET /api/auth/entra/callback?code=xxx&state=yyy
8. Backend troca o code por tokens:
   - POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
9. Backend decodifica o id_token e extrai:
   - oid: "abc123..." (Object ID — identificador imutável)
   - tid: "def456..." (Tenant ID)
   - preferred_username: "joao@empresa.com"
   - name: "João Silva"
   - email: "joao@empresa.com"
10. Backend busca entra_id_users WHERE entra_object_id = oid AND entra_tenant_id = tid
11. Se NÃO ENCONTROU e auto_provision = true:
    a. Cria registro em users (sem password, auth_method = 'entra_id')
    b. Cria registro em customers (vinculando ao user e company)
    c. Cria registro em entra_id_users (vinculando user ao OID/tenant)
12. Se ENCONTROU:
    a. Atualiza dados sincronizados (nome, email, UPN)
    b. Atualiza last_login_at
    c. Atualiza refresh_token (criptografado)
13. Cria sessão express-session com userId, userRole, companyId
14. Redirect para o frontend (/)
```

### 10.2 Login Subsequente

Igual ao fluxo acima, mas no passo 10 o usuário já existe, então apenas atualiza os dados sincronizados e cria nova sessão.

### 10.3 Coexistência com Login Local

O sistema deve suportar **ambos os métodos** simultaneamente:

- A tela de login mostra **formulário de usuário/senha** E botão **"Entrar com Microsoft"**
- Usuários com `auth_method = 'local'` usam o formulário
- Usuários com `auth_method = 'entra_id'` usam o botão Microsoft
- Usuários com `auth_method = 'both'` podem usar qualquer um
- O admin pode configurar qual método é obrigatório por empresa

---

## 11. Modificações no Frontend

### 11.1 Tela de Login

```
┌─────────────────────────────────────┐
│                                     │
│         🎫 GestaoTickets            │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Usuário                       │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Senha                         │  │
│  └───────────────────────────────┘  │
│                                     │
│  [        Entrar            ]       │
│                                     │
│  ─────────── ou ────────────        │
│                                     │
│  [ 🔷 Entrar com Microsoft  ]      │
│                                     │
│  Empresa: [  Selecionar...  ▼]      │
│                                     │
└─────────────────────────────────────┘
```

- O seletor de empresa só aparece se houver mais de uma empresa com Entra ID configurado
- Se a URL tem um subdomínio ou slug da empresa, o seletor não é necessário

### 11.2 Tela de Configuração (Company Admin)

Nova seção nas configurações da empresa para gerenciar o Entra ID:

- Campo para informar o **Tenant ID** do Entra
- Toggle para ativar/desativar SSO
- Toggle para auto-provisioning
- Lista de domínios permitidos
- Botão "Testar Conexão"
- Lista de usuários vinculados com opção de desvincular

---

## 12. Segurança

### 12.1 Validação de Tokens

O `id_token` recebido do Entra ID **deve ser validado** rigorosamente:

1. **Assinatura** — Verificar usando as chaves públicas (JWKS) de `https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys`
2. **Issuer (iss)** — Deve ser `https://login.microsoftonline.com/{tenant_id}/v2.0`
3. **Audience (aud)** — Deve ser o `ENTRA_CLIENT_ID`
4. **Expiração (exp)** — Token não pode estar expirado
5. **Nonce** — Deve corresponder ao nonce enviado na request (previne replay attacks)
6. **Tenant ID (tid)** — Deve corresponder a um `entra_id_configs.tenant_id` cadastrado

### 12.2 Proteção do Client Secret

- `ENTRA_CLIENT_SECRET` deve estar **apenas em variáveis de ambiente**, nunca no código ou BD
- Em produção, usar **Azure Key Vault** ou serviço equivalente
- Considerar usar **certificados** em vez de client secret (mais seguro)

### 12.3 Criptografia de Tokens no BD

O `refresh_token` armazenado em `entra_id_users.refresh_token` **deve ser criptografado**:

```typescript
// Exemplo usando AES-256-GCM
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encryptToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptToken(encrypted: string, key: Buffer): string {
  const [ivHex, tagHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 12.4 State Parameter (CSRF Protection)

O parâmetro `state` no fluxo OAuth deve:
- Ser um valor aleatório gerado por request
- Ser armazenado na sessão do usuário
- Ser validado no callback para prevenir CSRF

---

## 13. Dificuldades e Pontos de Atenção

### 13.1 Complexidade Baixa (Fácil)

- **App Registration** — Criar no Azure Portal é simples (5 minutos)
- **Fluxo OAuth** — Bem documentado, bibliotecas maduras
- **Multi-tenant** — Nativo do Entra ID, basta marcar a opção no App Registration

### 13.2 Complexidade Média

- **Auto-provisioning** — Decidir como mapear perfis do Entra ID para roles do sistema
- **Coexistência** — Manter login local funcionando em paralelo
- **Tela de login** — UX para escolher empresa (se multi-tenant)
- **Domínios customizados** — Se cada empresa acessa por subdomínio, simplifica bastante

### 13.3 Complexidade Alta

- **Mapeamento de grupos** — Se quiser mapear grupos do Entra ID para roles/departamentos do sistema, a complexidade aumenta significativamente (requer permissão `GroupMember.Read.All` e Admin Consent)
- **SCIM Provisioning** — Sincronização automática de usuários quando são adicionados/removidos do Entra ID (requer implementar um endpoint SCIM — complexo mas não necessário na v1)
- **Token Rotation** — Gerenciar refresh tokens expirados, revogados, etc.

---

## 14. Estimativa de Esforço

| Componente | Esforço |
|---|---|
| App Registration no Azure | 1 hora |
| Tabelas no BD (Drizzle schema + migrations) | 2-3 horas |
| Backend: serviço de autenticação Entra ID | 8-12 horas |
| Backend: endpoints de configuração (admin) | 4-6 horas |
| Backend: fluxo de auto-provisioning | 4-6 horas |
| Frontend: botão "Entrar com Microsoft" na tela de login | 2-3 horas |
| Frontend: tela de configuração Entra ID (admin) | 4-6 horas |
| Testes e debugging | 6-8 horas |
| Documentação e deploy | 2-3 horas |
| **Total estimado** | **~35-50 horas** |

---

## 15. Resumo das Entregas

### Fase 1 — Infraestrutura (BD + Config)
- [ ] Criar tabelas `entra_id_configs`, `entra_id_users`, `entra_id_login_logs`
- [ ] Alterar tabela `users` (password nullable, campo auth_method)
- [ ] Adicionar variáveis de ambiente
- [ ] Instalar dependências (`openid-client` ou `@azure/msal-node`)

### Fase 2 — Backend Auth
- [ ] Implementar serviço `entra-auth-service.ts`
- [ ] Endpoint `/api/auth/entra/login` (iniciar fluxo)
- [ ] Endpoint `/api/auth/entra/callback` (completar fluxo)
- [ ] Auto-provisioning de usuários
- [ ] Criptografia de refresh_token

### Fase 3 — Backend Admin
- [ ] CRUD de configuração Entra ID por empresa
- [ ] Endpoint de teste de conexão
- [ ] Listagem/vínculo/desvínculo de usuários

### Fase 4 — Frontend
- [ ] Botão "Entrar com Microsoft" na tela de login
- [ ] Seletor de empresa (se necessário)
- [ ] Tela de configuração do Entra ID (admin)
- [ ] Indicação visual de método de autenticação do usuário

### Fase 5 — Testes e Deploy
- [ ] Testar com tenant de desenvolvimento
- [ ] Testar auto-provisioning
- [ ] Testar coexistência com login local
- [ ] Documentar processo de onboarding de clientes
- [ ] Deploy

---

## 16. Referências

- [Microsoft Entra ID - Documentação Oficial](https://learn.microsoft.com/en-us/entra/identity/)
- [OAuth 2.0 Authorization Code Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Multi-tenant Applications](https://learn.microsoft.com/en-us/entra/identity-platform/howto-convert-app-to-be-multi-tenant)
- [OpenID Connect com Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- [openid-client (npm)](https://www.npmjs.com/package/openid-client)
- [@azure/msal-node (npm)](https://www.npmjs.com/package/@azure/msal-node)
