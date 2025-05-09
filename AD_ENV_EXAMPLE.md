# Configuração de Variáveis de Ambiente para Active Directory

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# URL do servidor LDAP
# Formato: ldap://servidor.dominio.com ou ldaps://servidor.dominio.com (para conexão segura)
AD_URL=ldap://seu-servidor-ad.com

# Distinguished Name base para busca no AD
# Exemplo: dc=empresa,dc=com ou dc=seudominio,dc=local
AD_BASE_DN=dc=seu-dominio,dc=com

# Credenciais da conta de serviço para acessar o AD
# Esta conta deve ter permissões de leitura no AD
AD_USERNAME=usuario@seu-dominio.com
AD_PASSWORD=sua-senha-ad

# Domínio do Active Directory (apenas a parte após o @ em um email)
AD_DOMAIN=seu-dominio.com

# Grupos do AD para mapeamento de funções no sistema
# Membros desses grupos receberão automaticamente as funções no sistema
AD_ADMIN_GROUP=SistemaGestao-Admins
AD_SUPPORT_GROUP=SistemaGestao-Suporte
```

## Instruções de Configuração

1. **AD_URL**: Substitua pelo endereço do seu servidor AD
   * Para conexão não segura: `ldap://servidor.seu-dominio.com`
   * Para conexão segura: `ldaps://servidor.seu-dominio.com`

2. **AD_BASE_DN**: O Distinguished Name (DN) base para buscar usuários
   * Formato: `dc=componente1,dc=componente2,dc=componente3`
   * Exemplo para domínio `empresa.com.br`: `dc=empresa,dc=com,dc=br`

3. **AD_USERNAME**: Conta de serviço com permissões para ler dados do AD
   * Use o formato UPN: `usuario@dominio.com`
   * Esta conta NÃO precisa ser administradora, apenas ter permissões de leitura

4. **AD_PASSWORD**: Senha da conta de serviço

5. **AD_DOMAIN**: Apenas o nome do domínio, sem o @
   * Exemplo: `empresa.com`

6. **AD_ADMIN_GROUP/AD_SUPPORT_GROUP**: Nomes dos grupos no AD que serão mapeados para funções no sistema
   * Por padrão: `SistemaGestao-Admins` e `SistemaGestao-Suporte`
   * Adapte para os nomes dos grupos que você criou no seu AD 