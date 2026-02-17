# Guia Prático: Configurando Microsoft Entra ID para o GestaoTickets

> **Pré-requisito:** Ter lido o documento `entra-id-autenticacao-analise.md` para entender o contexto geral.

---

## PARTE 1 — O que fazer no lado da Microsoft (Azure Portal)

### Passo 1: Acessar o Azure Portal

1. Acesse [https://portal.azure.com](https://portal.azure.com)
2. Faça login com uma conta que tenha permissão de **Administrador Global** ou **Administrador de Aplicativos** no seu tenant Microsoft
3. Se não tiver uma conta Azure/Entra, pode criar uma gratuita em [https://azure.microsoft.com/free](https://azure.microsoft.com/free)

> **Nota:** Você só precisa fazer isso **UMA VEZ** no seu próprio tenant. Os clientes **não** precisam criar nada no Azure deles.

---

### Passo 2: Criar o App Registration

1. No portal, pesquise **"App registrations"** na barra de busca (ou **"Registros de aplicativo"** se estiver em PT)
2. Clique em **"+ New registration"** (Novo registro)

Preencha:

| Campo | Valor |
|---|---|
| **Name** | `GestaoTickets` (ou o nome que preferir) |
| **Supported account types** | Selecione: **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)"** |
| **Redirect URI** | Plataforma: **Web** / URI: `https://seudominio.com/api/auth/entra/callback` |

3. Clique em **"Register"**

> **Sobre o "Supported account types":**
> - Se escolher "Single tenant" → só usuários do SEU tenant podem logar
> - Se escolher **"Multitenant"** → usuários de QUALQUER organização Microsoft podem logar ✅
> - Se escolher "Multitenant + personal" → inclui contas pessoais (@outlook.com, @hotmail.com)

---

### Passo 3: Anotar as Credenciais

Após criar o registro, a tela de **Overview** mostra:

```
Application (client) ID:  a1b2c3d4-e5f6-7890-abcd-ef1234567890  ← COPIE ESTE
Directory (tenant) ID:    xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx    ← Não precisa para multi-tenant
```

**Guarde o `Application (client) ID`** — Este será a variável `ENTRA_CLIENT_ID`.

---

### Passo 4: Criar o Client Secret

1. No menu lateral do App Registration, clique em **"Certificates & secrets"**
2. Na aba **"Client secrets"**, clique em **"+ New client secret"**
3. Defina uma descrição (ex: `GestaoTickets-Production`) e uma expiração:
   - Recomendado: **24 months** (será necessário renovar antes de expirar)
4. Clique em **"Add"**
5. **COPIE O VALOR DO SECRET IMEDIATAMENTE** — ele só é mostrado uma vez!

```
Secret ID:     xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  ← não precisa desse
Value:         xYz~AbC.1234567890abcdefghijklmnop     ← COPIE ESTE (é o ENTRA_CLIENT_SECRET)
Expires:       17/02/2028
```

> ⚠️ **ATENÇÃO:** Se você sair da tela sem copiar o Value, terá que criar um novo secret. O Azure nunca mostra o valor novamente.

---

### Passo 5: Configurar as Permissões (API Permissions)

1. No menu lateral, clique em **"API permissions"**
2. Clique em **"+ Add a permission"**
3. Selecione **"Microsoft Graph"**
4. Selecione **"Delegated permissions"**
5. Marque as seguintes permissões:

| Permissão | Já incluída por padrão? | Descrição |
|---|---|---|
| `openid` | ✅ Sim | Permite autenticação OpenID Connect |
| `profile` | ✅ Sim | Acesso ao nome e dados do perfil |
| `email` | ❌ Adicionar | Acesso ao email do usuário |
| `User.Read` | ✅ Sim | Ler o perfil do usuário logado |
| `offline_access` | ❌ Adicionar | Permite obter refresh_token |

6. Clique em **"Add permissions"**

> **Não é necessário "Grant admin consent"** para essas permissões — elas são todas "Delegated" de baixo risco e qualquer usuário pode consentir individualmente.

A tela de API Permissions deve ficar assim:

```
┌───────────────────────────────────────────────────────────────┐
│ API / Permissions name          │ Type      │ Status          │
│─────────────────────────────────│───────────│─────────────────│
│ Microsoft Graph                 │           │                 │
│   email                        │ Delegated │ Granted for ... │
│   offline_access               │ Delegated │ Granted for ... │
│   openid                       │ Delegated │ Granted for ... │
│   profile                      │ Delegated │ Granted for ... │
│   User.Read                    │ Delegated │ Granted for ... │
└───────────────────────────────────────────────────────────────┘
```

---

### Passo 6: Configurar a Redirect URI (Ambiente de Desenvolvimento)

Se você também desenvolve localmente, adicione mais uma redirect URI:

1. No menu lateral, clique em **"Authentication"**
2. Na seção **"Web" → "Redirect URIs"**, clique em **"Add URI"**
3. Adicione: `http://localhost:5000/api/auth/entra/callback` (ou a porta que usa)
4. Clique em **"Save"**

A lista final de Redirect URIs fica:

```
https://seudominio.com/api/auth/entra/callback     ← Produção
http://localhost:5000/api/auth/entra/callback        ← Desenvolvimento
```

---

### Passo 7: (Opcional) Configurar Token Claims

Para receber informações extras no token:

1. No menu lateral, clique em **"Token configuration"**
2. Clique em **"+ Add optional claim"**
3. Selecione **"ID"** (id_token)
4. Marque:
   - `email`
   - `preferred_username`
   - `upn` (se disponível)
5. Clique em **"Add"**

---

### Resumo: O que você tem agora

Após esses 7 passos, você possui:

```env
# Valores obtidos do Azure Portal
ENTRA_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890      # Do Passo 3
ENTRA_CLIENT_SECRET=xYz~AbC.1234567890abcdefghijklmnop     # Do Passo 4
ENTRA_REDIRECT_URI=https://seudominio.com/api/auth/entra/callback  # Do Passo 2
```

---

## PARTE 2 — O que os clientes precisam fazer (quase nada)

### Cenário: Novo cliente quer usar SSO com Entra ID

O cliente **NÃO precisa criar nada no Azure**. O fluxo é:

#### O que o cliente precisa informar:

1. **Tenant ID da organização Microsoft dele**

Como encontrar:
- O admin do Entra ID do cliente acessa [https://portal.azure.com](https://portal.azure.com)
- Vai em **"Microsoft Entra ID"** (ou "Azure Active Directory")
- Na tela de **Overview**, copia o **"Tenant ID"**

```
Tenant ID: f9a8b7c6-d5e4-3210-fedc-ba0987654321
```

Esse é o único dado que o cliente precisa fornecer.

#### O que acontece no primeiro acesso de um usuário do cliente:

1. Usuário clica "Entrar com Microsoft"
2. É redirecionado para o login da Microsoft
3. Microsoft pergunta: **"Este app quer acessar seu perfil e email. Permitir?"**
4. Usuário clica "Aceitar" (consent individual)
5. Pronto — está logado

> **Consentimento do Admin (Admin Consent):** Não é obrigatório para as permissões que pedimos. Porém, o admin do Entra ID do cliente **pode** dar consentimento global para todos os usuários dele, eliminando o prompt individual. Isso é feito em "Enterprise Applications" no portal Azure do cliente.

---

### Cenário: Cliente quer restringir quem pode acessar

Se o cliente quiser que apenas **alguns** usuários (e não todos do tenant) possam logar:

1. O admin do Entra ID do cliente acessa **"Enterprise Applications"** no portal Azure dele
2. Encontra o app **"GestaoTickets"** (aparece automaticamente após o primeiro login)
3. Vai em **"Properties"**
4. Muda **"Assignment required?"** para **"Yes"**
5. Vai em **"Users and groups"** e adiciona os usuários/grupos permitidos

Isso é 100% do lado do cliente — você não precisa fazer nada na sua aplicação.

---

## PARTE 3 — O que fazer na aplicação (Backend)

### Passo 1: Instalar dependências

```bash
npm install openid-client
```

> **Por que `openid-client` e não `@azure/msal-node`?**
> - `openid-client` é mais leve e genérico (funciona com qualquer provedor OIDC)
> - `msal-node` é a lib oficial da Microsoft, mais pesada, com mais features que não precisamos
> - Ambas funcionam — `openid-client` é mais idiomático para um backend Express

### Passo 2: Criar o serviço de autenticação Entra ID

Criar o arquivo `server/services/entra-auth-service.ts`. A lógica principal:

```typescript
// server/services/entra-auth-service.ts
import { Issuer, Client, generators } from 'openid-client';
import { db } from '../db';
import { entraIdConfigs, entraIdUsers, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Cache de clientes OIDC por tenant (evita re-discovery a cada request)
const clientCache = new Map<string, { client: Client; expiresAt: number }>();

/**
 * Descobre o provedor OIDC do Entra ID para um tenant específico
 * e retorna um Client configurado.
 */
async function getOIDCClient(tenantId: string): Promise<Client> {
  const cached = clientCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.client;
  }

  // Discovery automático — busca os endpoints do tenant
  const issuer = await Issuer.discover(
    `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
  );

  const client = new issuer.Client({
    client_id: process.env.ENTRA_CLIENT_ID!,
    client_secret: process.env.ENTRA_CLIENT_SECRET!,
    redirect_uris: [process.env.ENTRA_REDIRECT_URI!],
    response_types: ['code'],
  });

  // Cache por 1 hora
  clientCache.set(tenantId, {
    client,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });

  return client;
}

/**
 * Gera a URL de autorização para redirecionar o usuário ao login Microsoft
 */
export async function getAuthorizationUrl(tenantId: string, state: string, nonce: string): Promise<string> {
  const client = await getOIDCClient(tenantId);

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  const url = client.authorizationUrl({
    scope: 'openid profile email offline_access',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Retornar tanto a URL quanto o codeVerifier (para salvar na sessão)
  return url;
}

/**
 * Troca o authorization_code por tokens e retorna as claims do usuário
 */
export async function handleCallback(
  tenantId: string,
  callbackParams: any,
  codeVerifier: string,
  expectedState: string,
  expectedNonce: string
) {
  const client = await getOIDCClient(tenantId);

  const tokenSet = await client.callback(
    process.env.ENTRA_REDIRECT_URI!,
    callbackParams,
    {
      state: expectedState,
      nonce: expectedNonce,
      code_verifier: codeVerifier,
    }
  );

  const claims = tokenSet.claims();

  return {
    claims: {
      oid: claims.sub || claims.oid,       // Object ID do usuário
      tid: claims.tid,                      // Tenant ID
      email: claims.email || claims.preferred_username,
      name: claims.name,
      upn: claims.preferred_username,
    },
    tokens: {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : null,
    },
  };
}
```

### Passo 3: Criar os endpoints de autenticação

Adicionar em `server/routes.ts`:

```typescript
// ============== ENTRA ID AUTH ==============

// Inicia o fluxo de login com Microsoft
app.get('/api/auth/entra/login', async (req, res) => {
  try {
    const companySlug = req.query.company as string;
    if (!companySlug) {
      return res.status(400).json({ message: 'Parâmetro company é obrigatório' });
    }

    // Buscar configuração do Entra ID para esta empresa
    const config = await getEntraConfigByCompanySlug(companySlug);
    if (!config || !config.enabled) {
      return res.status(404).json({ message: 'SSO não configurado para esta empresa' });
    }

    // Gerar state e nonce para segurança
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const codeVerifier = generators.codeVerifier();

    // Salvar na sessão para validar no callback
    req.session.entraState = state;
    req.session.entraNonce = nonce;
    req.session.entraCodeVerifier = codeVerifier;
    req.session.entraTenantId = config.tenant_id;
    req.session.entraCompanyId = config.company_id;

    const authUrl = await getAuthorizationUrl(config.tenant_id, state, nonce);

    res.redirect(authUrl);
  } catch (error) {
    console.error('Erro ao iniciar login Entra ID:', error);
    res.status(500).json({ message: 'Erro ao iniciar autenticação' });
  }
});

// Callback — Microsoft redireciona para cá após o login
app.get('/api/auth/entra/callback', async (req, res) => {
  try {
    const { entraState, entraNonce, entraCodeVerifier, entraTenantId, entraCompanyId } = req.session;

    if (!entraState || !entraTenantId) {
      return res.status(400).json({ message: 'Sessão de autenticação inválida' });
    }

    const result = await handleCallback(
      entraTenantId,
      req.query,              // contém o code e state
      entraCodeVerifier,
      entraState,
      entraNonce
    );

    // Limpar dados temporários da sessão
    delete req.session.entraState;
    delete req.session.entraNonce;
    delete req.session.entraCodeVerifier;
    delete req.session.entraTenantId;

    // Buscar ou criar usuário no sistema
    const user = await findOrCreateEntraUser(result.claims, entraCompanyId, result.tokens);

    // Criar sessão (mesmo formato do login local)
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.companyId = user.company_id;

    // Redirecionar para o frontend
    res.redirect('/');
  } catch (error) {
    console.error('Erro no callback Entra ID:', error);
    res.redirect('/login?error=sso_failed');
  }
});
```

### Passo 4: Implementar auto-provisioning de usuários

```typescript
/**
 * Busca o usuário pelo Object ID do Entra, ou cria um novo se auto_provision = true
 */
async function findOrCreateEntraUser(claims, companyId, tokens) {
  // 1. Buscar vínculo existente
  const [existing] = await db
    .select()
    .from(entraIdUsers)
    .where(and(
      eq(entraIdUsers.entra_object_id, claims.oid),
      eq(entraIdUsers.entra_tenant_id, claims.tid)
    ))
    .limit(1);

  if (existing) {
    // Atualizar dados sincronizados e tokens
    await db.update(entraIdUsers)
      .set({
        entra_display_name: claims.name,
        entra_email: claims.email,
        entra_upn: claims.upn,
        refresh_token: encryptToken(tokens.refreshToken),
        token_expires_at: tokens.expiresAt,
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(entraIdUsers.id, existing.id));

    // Retornar o usuário do sistema
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, existing.user_id))
      .limit(1);
    return user;
  }

  // 2. Usuário não existe — verificar auto_provision
  const [config] = await db
    .select()
    .from(entraIdConfigs)
    .where(eq(entraIdConfigs.company_id, companyId))
    .limit(1);

  if (!config?.auto_provision) {
    throw new Error('Usuário não encontrado e auto-provisioning desativado');
  }

  // 3. Verificar domínio permitido
  if (config.allowed_domains?.length > 0) {
    const emailDomain = claims.email.split('@')[1];
    if (!config.allowed_domains.includes(emailDomain)) {
      throw new Error(`Domínio ${emailDomain} não permitido para esta empresa`);
    }
  }

  // 4. Criar usuário no sistema
  const [newUser] = await db
    .insert(users)
    .values({
      username: claims.upn || claims.email,
      email: claims.email,
      name: claims.name,
      password: null,           // Sem senha local
      auth_method: 'entra_id',
      role: config.default_role || 'customer',
      company_id: companyId,
      active: true,
      ad_user: false,
    })
    .returning();

  // 5. Criar vínculo Entra ID ↔ Usuário
  await db.insert(entraIdUsers).values({
    user_id: newUser.id,
    entra_object_id: claims.oid,
    entra_tenant_id: claims.tid,
    entra_upn: claims.upn,
    entra_display_name: claims.name,
    entra_email: claims.email,
    refresh_token: encryptToken(tokens.refreshToken),
    token_expires_at: tokens.expiresAt,
    last_login_at: new Date(),
    is_active: true,
  });

  // 6. Criar registro de customer (se a role for customer)
  if ((config.default_role || 'customer') === 'customer') {
    await db.insert(customers).values({
      name: claims.name,
      email: claims.email,
      user_id: newUser.id,
      company_id: companyId,
    });
  }

  return newUser;
}
```

### Passo 5: Criar as tabelas no schema Drizzle

Adicionar ao arquivo `shared/schema.ts` as definições das 3 tabelas novas + alterar a tabela `users` conforme descrito no documento de análise (`entra-id-autenticacao-analise.md`, Seção 6).

### Passo 6: Rodar a migration

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## PARTE 4 — O que fazer na aplicação (Frontend)

### Passo 1: Botão "Entrar com Microsoft" na tela de login

```tsx
// Componente simplificado
function MicrosoftLoginButton({ companySlug }: { companySlug: string }) {
  const handleClick = () => {
    // Simplesmente redireciona — o backend cuida do resto
    window.location.href = `/api/auth/entra/login?company=${companySlug}`;
  };

  return (
    <button onClick={handleClick} className="flex items-center gap-2 ...">
      <MicrosoftIcon />
      Entrar com Microsoft
    </button>
  );
}
```

> O botão só faz um redirect. Todo o fluxo OAuth acontece no backend. O frontend não manipula tokens.

### Passo 2: Tela de configuração do Entra ID (para Company Admin)

Criar uma nova seção nas configurações da empresa:

```tsx
function EntraIdSettings() {
  const [config, setConfig] = useState({
    tenant_id: '',
    enabled: false,
    auto_provision: true,
    default_role: 'customer',
    allowed_domains: [],
  });

  // GET /api/entra/config → carrega configuração atual
  // POST /api/entra/config → salva configuração

  return (
    <Card>
      <CardHeader>
        <CardTitle>Microsoft Entra ID (SSO)</CardTitle>
        <CardDescription>
          Configure a autenticação via Microsoft para os usuários da sua empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Toggle Ativar/Desativar */}
          <div className="flex items-center justify-between">
            <Label>SSO Ativo</Label>
            <Switch checked={config.enabled} onCheckedChange={...} />
          </div>

          {/* Tenant ID */}
          <div>
            <Label>Tenant ID da sua organização Microsoft</Label>
            <Input
              value={config.tenant_id}
              onChange={...}
              placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
            />
            <p className="text-sm text-muted-foreground">
              Encontre em portal.azure.com → Microsoft Entra ID → Overview
            </p>
          </div>

          {/* Auto-provisioning */}
          <div className="flex items-center justify-between">
            <Label>Criar usuário automaticamente no primeiro login</Label>
            <Switch checked={config.auto_provision} onCheckedChange={...} />
          </div>

          {/* Role padrão */}
          <div>
            <Label>Perfil padrão para novos usuários</Label>
            <Select value={config.default_role} onValueChange={...}>
              <SelectItem value="customer">Solicitante</SelectItem>
              <SelectItem value="support">Atendente</SelectItem>
              <SelectItem value="viewer">Visualizador</SelectItem>
            </Select>
          </div>

          {/* Domínios permitidos */}
          <div>
            <Label>Domínios de email permitidos (opcional)</Label>
            <Input placeholder="empresa.com.br, empresa.com" />
          </div>

          {/* Botão Testar */}
          <Button variant="outline">Testar Conexão</Button>

          {/* Botão Salvar */}
          <Button>Salvar Configuração</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## PARTE 5 — Fluxo completo de onboarding de um novo cliente

Resumo do processo para adicionar um novo cliente com SSO:

```
┌─────────────────────────────────────────────────────────────────┐
│                  ONBOARDING DE CLIENTE COM SSO                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ADMIN do GestaoTickets:                                     │
│     └─ Cria a empresa (company) no sistema normalmente          │
│                                                                 │
│  2. COMPANY_ADMIN da empresa:                                   │
│     └─ Acessa Configurações → Entra ID                          │
│     └─ Informa o Tenant ID da organização Microsoft             │
│     └─ Define se quer auto-provisioning (sim/não)               │
│     └─ Define o perfil padrão (customer, viewer, etc.)          │
│     └─ Ativa o SSO                                              │
│                                                                 │
│  3. USUÁRIOS da empresa:                                        │
│     └─ Acessam a tela de login                                  │
│     └─ Clicam "Entrar com Microsoft"                            │
│     └─ Fazem login com o email corporativo + MFA                │
│     └─ Na primeira vez, aceitam o consentimento                 │
│     └─ São criados automaticamente no sistema (se auto-prov.)   │
│     └─ Já estão logados e podem usar o sistema                  │
│                                                                 │
│  PRONTO! Não precisa de mais nada.                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PARTE 6 — Perguntas Frequentes

### "Preciso pagar algo na Microsoft?"

**Não.** O plano gratuito do Entra ID (Free tier) já suporta App Registrations e autenticação OAuth/OIDC. Não há custo por autenticação.

### "O client secret expira?"

**Sim.** O máximo é 24 meses. Você precisa renovar antes de expirar, senão o login SSO para de funcionar. Recomendação: criar um alerta/lembrete para 30 dias antes da expiração.

Para renovar:
1. Azure Portal → App Registrations → GestaoTickets → Certificates & secrets
2. Criar novo secret
3. Atualizar a variável `ENTRA_CLIENT_SECRET` no servidor
4. Deletar o secret antigo

### "E se o cliente usar Google Workspace em vez de Microsoft?"

O mesmo padrão OAuth 2.0 / OpenID Connect funciona com o Google. A arquitetura de tabelas proposta suporta isso — bastaria criar uma tabela `google_workspace_configs` análoga e um novo App no Google Cloud Console.

### "E se eu quiser forçar que uma empresa use APENAS SSO (sem senha local)?"

Adicione um campo `force_sso: boolean` na tabela `entra_id_configs`. No endpoint de login local (`POST /api/auth/login`), antes de autenticar, verifique:

```typescript
if (user.company_id) {
  const entraConfig = await getEntraConfig(user.company_id);
  if (entraConfig?.force_sso && entraConfig.enabled) {
    return res.status(403).json({
      message: 'Esta empresa requer autenticação via Microsoft. Use o botão "Entrar com Microsoft".'
    });
  }
}
```

### "Preciso de HTTPS?"

**Sim, em produção.** O Entra ID exige que a Redirect URI use HTTPS (exceto para `localhost`). Você já precisa de HTTPS para qualquer aplicação web em produção de qualquer forma.

### "Posso testar localmente?"

**Sim.** O Entra ID permite `http://localhost:porta/...` como Redirect URI para desenvolvimento. Basta adicionar no Passo 6 da Parte 1.

### "O que acontece se o usuário for desativado no Entra ID do cliente?"

O Entra ID **rejeita o login** automaticamente. O usuário não consegue mais passar pela tela de login da Microsoft, então nunca chega no seu callback. Não precisa fazer nada no seu lado.

### "Preciso armazenar o access_token?"

**Não necessariamente.** Se você só precisa autenticar (saber quem é o usuário), o `id_token` no momento do callback é suficiente. O `access_token` só é necessário se quiser chamar APIs do Microsoft Graph (ex: buscar foto do perfil, listar grupos). O `refresh_token` é útil se quiser renovar sessões sem pedir login novamente.

---

## PARTE 7 — Checklist Final

### No Azure Portal (uma vez):
- [ ] Criar App Registration (multi-tenant)
- [ ] Copiar o `Application (client) ID`
- [ ] Criar Client Secret e copiar o `Value`
- [ ] Configurar API Permissions (email, offline_access)
- [ ] Adicionar Redirect URIs (produção + desenvolvimento)
- [ ] (Opcional) Configurar Token Claims

### No servidor (.env):
- [ ] Definir `ENTRA_CLIENT_ID`
- [ ] Definir `ENTRA_CLIENT_SECRET`
- [ ] Definir `ENTRA_REDIRECT_URI`
- [ ] Definir `ENTRA_TOKEN_ENCRYPTION_KEY` (gerar chave aleatória de 32 bytes)

### No código (backend):
- [ ] Instalar `openid-client`
- [ ] Criar tabelas no schema Drizzle e rodar migration
- [ ] Implementar `entra-auth-service.ts`
- [ ] Criar endpoints `/api/auth/entra/login` e `/api/auth/entra/callback`
- [ ] Implementar auto-provisioning
- [ ] Criar endpoints de configuração (CRUD do entra_id_configs)
- [ ] Atualizar types da sessão (`express-session.d.ts`)

### No código (frontend):
- [ ] Adicionar botão "Entrar com Microsoft" na tela de login
- [ ] Criar tela de configuração do Entra ID (empresa admin)
- [ ] Tratar erro de SSO na tela de login (`?error=sso_failed`)

### Para cada novo cliente:
- [ ] Criar empresa no sistema
- [ ] Company admin configura o Tenant ID
- [ ] Testar login com um usuário do tenant
