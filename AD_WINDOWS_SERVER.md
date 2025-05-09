# Configuração do Active Directory no Windows Server

## Pré-requisitos
- Windows Server (2016, 2019 ou 2022) com Active Directory Domain Services instalado e configurado
- Acesso administrativo ao servidor

## Criação de Grupos para o Sistema de Gestão de Chamados

### 1. Abrir o Gerenciador de Usuários e Computadores do Active Directory

1. No servidor, clique em "Iniciar"
2. Pesquise e abra "Active Directory Users and Computers" (Usuários e Computadores do Active Directory)

### 2. Criar Grupos de Segurança

Vamos criar dois grupos especiais que serão usados pelo sistema:

#### Grupo para Administradores do Sistema

1. Clique com o botão direito na OU (Unidade Organizacional) onde deseja criar o grupo
2. Selecione "New" > "Group"
3. Preencha as informações:
   - Group name: `SistemaGestao-Admins`
   - Group scope: `Global`
   - Group type: `Security`
4. Clique em "OK"

#### Grupo para Equipe de Suporte

1. Clique com o botão direito na mesma OU
2. Selecione "New" > "Group"
3. Preencha as informações:
   - Group name: `SistemaGestao-Suporte`
   - Group scope: `Global`
   - Group type: `Security`
4. Clique em "OK"

### 3. Adicionar Usuários aos Grupos

1. Abra o grupo criado com duplo clique
2. Vá para a guia "Members"
3. Clique em "Add"
4. Procure e selecione os usuários que devem ser administradores ou agentes de suporte
5. Clique em "OK" e depois em "Apply"

## Criar Conta de Serviço para o Sistema

É recomendado criar uma conta dedicada para o sistema acessar o AD:

1. Clique com o botão direito na OU onde deseja criar o usuário
2. Selecione "New" > "User"
3. Preencha as informações:
   - First name: `Sistema`
   - Last name: `Gestao`
   - User logon name: `sistema.gestao`
4. Clique em "Next"
5. Defina uma senha forte e selecione:
   - "Password never expires" (para evitar interrupções no serviço)
   - Desmarque "User must change password at next logon"
6. Clique em "Next" e depois em "Finish"

### Configurar Permissões da Conta de Serviço

Esta conta precisa apenas de permissões para ler informações de usuários e grupos:

1. Não é necessário adicionar esta conta a grupos administrativos
2. A conta de serviço precisa apenas de permissões de leitura para:
   - Ler propriedades de usuários
   - Ler associações de grupos

## Teste da Configuração

Para testar se os grupos estão configurados corretamente:

1. Faça login em uma estação de trabalho com um usuário membro do grupo `SistemaGestao-Admins`
2. Tente fazer login no sistema de gestão de chamados marcando a opção "Autenticar com Active Directory"
3. Você deve receber permissões de administrador automaticamente

## Configurações no Sistema de Gestão de Chamados

Após criar os grupos e a conta de serviço, atualize o arquivo `.env` do sistema com:

```
AD_URL=ldap://seu-servidor-ad.com
AD_BASE_DN=dc=seu-dominio,dc=com
AD_USERNAME=sistema.gestao@seu-dominio.com
AD_PASSWORD=senha-da-conta-de-servico
AD_DOMAIN=seu-dominio.com
AD_ADMIN_GROUP=SistemaGestao-Admins
AD_SUPPORT_GROUP=SistemaGestao-Suporte
```

## Resolução de Problemas

### Problema: Falha na autenticação
- Verifique se o nome de usuário e senha da conta de serviço estão corretos
- Verifique se a URL do servidor LDAP está correta
- Tente usar o formato UPN completo (usuario@dominio) para o nome de usuário

### Problema: Grupos não são reconhecidos
- Verifique se o Base DN está configurado corretamente
- Verifique se os nomes dos grupos correspondem exatamente aos configurados no sistema
- Verifique se a conta de serviço tem permissões para ler associações de grupos 