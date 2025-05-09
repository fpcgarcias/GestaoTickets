# Configuração de Autenticação com Active Directory

## Visão Geral

Este documento descreve como configurar a autenticação com Active Directory (AD) para o Sistema de Gestão de Chamados.

## Requisitos

- Servidor Active Directory configurado e acessível pela rede
- Conta de serviço no AD com permissões de leitura para autenticação e busca de usuários
- Grupos do AD criados para definir as funções dos usuários (opcional, mas recomendado)

## Configuração de Variáveis de Ambiente

Crie ou edite seu arquivo `.env` na raiz do projeto e adicione as seguintes variáveis:

```
# Configurações do Active Directory
AD_URL=ldap://seu-servidor-ad.com
AD_BASE_DN=dc=seu-dominio,dc=com
AD_USERNAME=admin@seu-dominio.com
AD_PASSWORD=sua-senha-admin
AD_DOMAIN=seu-dominio.com

# Grupos do Active Directory para mapeamento de funções
AD_ADMIN_GROUP=SistemaGestao-Admins
AD_SUPPORT_GROUP=SistemaGestao-Suporte
```

### Detalhes das Variáveis

- `AD_URL`: URL do seu servidor LDAP, geralmente no formato `ldap://servidor` ou `ldaps://servidor` para conexão segura
- `AD_BASE_DN`: O DN (Distinguished Name) base usado para buscar usuários, ex: `dc=empresa,dc=com`
- `AD_USERNAME`: Nome de usuário da conta de serviço com permissões para acessar o AD
- `AD_PASSWORD`: Senha da conta de serviço
- `AD_DOMAIN`: Nome do domínio (apenas a parte após o @ em um endereço de email)
- `AD_ADMIN_GROUP`: Nome do grupo no AD cujos membros terão função de administrador no sistema
- `AD_SUPPORT_GROUP`: Nome do grupo no AD cujos membros terão função de suporte no sistema

## Mapeamento de Grupos para Funções

Os usuários serão automaticamente mapeados para funções no sistema com base nos grupos do AD:

1. Membros do grupo definido em `AD_ADMIN_GROUP` serão administradores no sistema
2. Membros do grupo definido em `AD_SUPPORT_GROUP` serão agentes de suporte
3. Outros usuários serão definidos como clientes (role 'customer')

## Como usar

1. Inicie o sistema normalmente
2. Na tela de login, insira seu nome de usuário do AD (pode ser o nome de usuário ou email completo)
3. Marque a opção "Autenticar com Active Directory"
4. Insira sua senha do AD
5. Clique em "Entrar"

## Troubleshooting

Se encontrar problemas na autenticação, verifique:

1. As credenciais da conta de serviço estão corretas?
2. O servidor AD está acessível a partir do servidor da aplicação?
3. Os grupos do AD estão configurados corretamente?
4. Os nomes de usuário estão no formato correto? 

### Logs de Depuração

Para verificar problemas de conexão, analise os logs do servidor. Os logs relacionados à autenticação AD começam com:
- `Erro na autenticação AD:`
- `Erro ao buscar usuário no AD:`
- `Erro ao verificar grupo AD:`

## Segurança

- Certifique-se de que as credenciais do AD estão armazenadas de forma segura
- Considere usar LDAPS (LDAP sobre SSL) para proteger a comunicação com o AD
- A conta de serviço deve ter permissões mínimas necessárias, apenas de leitura 