# Implementação da Autenticação com Active Directory

## Alterações Realizadas

### 1. Instalação de Dependências
- Adicionado o pacote `activedirectory2` para integração com o Active Directory.

### 2. Utilitários para Integração com Active Directory
- Criado o arquivo `server/utils/active-directory.ts` com funções para:
  - Autenticação de usuários no AD
  - Verificação de membros em grupos do AD
  - Middleware para verificação de permissões baseadas em grupos do AD

### 3. Modificação da Rota de Login
- Atualizada a rota `/api/auth/login` para suportar dois modos de autenticação:
  - Autenticação local (sistema existente)
  - Autenticação via Active Directory quando `useAD` é `true`
- Para autenticação via AD:
  - Valida credenciais contra o servidor AD
  - Cria/Atualiza usuário local com base nos dados do AD
  - Mapeia grupos do AD para funções no sistema

### 4. Alterações no Frontend
- Adicionado checkbox "Autenticar com Active Directory" no formulário de login
- Atualizado o hook `useAuth` para enviar o parâmetro `useAD` para a API
- Adicionado indicador `isADUser` para identificar usuários importados do AD

### 5. Banco de Dados
- Criado script de migração `migrate-ad-user-field.js` para adicionar o campo `adUser` à tabela de usuários
- Este campo identifica usuários que foram importados/autenticados pelo AD

### 6. Configuração
- Criado arquivo `AD_SETUP.md` com instruções de configuração
- Definição das variáveis de ambiente necessárias para conectar ao AD:
  - `AD_URL`: URL do servidor LDAP
  - `AD_BASE_DN`: Base DN para busca de usuários
  - `AD_USERNAME`: Conta de serviço para autenticação
  - `AD_PASSWORD`: Senha da conta de serviço
  - `AD_DOMAIN`: Nome do domínio
  - `AD_ADMIN_GROUP`: Grupo para usuários administradores
  - `AD_SUPPORT_GROUP`: Grupo para usuários de suporte

## Como Testar a Implementação

1. Configure as variáveis de ambiente conforme descrito em `AD_SETUP.md`
2. Execute a migração do banco de dados: `node server/migrate-ad-user-field.js`
3. Reinicie o servidor
4. Na tela de login, marque a opção "Autenticar com Active Directory"
5. Insira suas credenciais do Active Directory
6. Clique em "Entrar"

## Comportamento Esperado

1. Ao fazer login com Active Directory:
   - Usuários autenticados via AD terão seus dados atualizados com as informações mais recentes do AD
   - Novos usuários serão criados automaticamente com base nos dados do AD
   - Funções/papéis serão atribuídos automaticamente com base nos grupos do AD

2. Mapeamento de Grupos para Funções:
   - Membros do grupo `AD_ADMIN_GROUP` → Função `admin`
   - Membros do grupo `AD_SUPPORT_GROUP` → Função `support`
   - Outros usuários → Função `customer`

## Considerações de Segurança

- Certifique-se de que as credenciais do AD estão armazenadas de forma segura
- Recomenda-se usar LDAPS (LDAP sobre SSL) para conexões seguras
- A conta de serviço deve ter privilégios mínimos necessários no AD 