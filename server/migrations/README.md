# Sistema de Migrações do Banco de Dados

Este diretório contém as migrações do banco de dados para corrigir e manter a estrutura do sistema de gestão de tickets.

## 📋 Migrações Disponíveis

### `20241228-fix-database-structure.ts`
**Descrição**: Migração abrangente para corrigir inconsistências na estrutura do banco de dados.

**Problemas Corrigidos**:
1. **Tabela `companies`**: Corrige nomes das colunas de camelCase para snake_case
2. **Tabela `officials`**: Adiciona colunas faltantes (`company_id`, `department_id`, `supervisor_id`, `manager_id`)
3. **Tabela `incident_types`**: Adiciona coluna `is_active`
4. **Constraint `system_settings`**: Corrige constraint única para ser composta (`key`, `company_id`)

**Novas Tabelas Criadas**:
- `departments` - Departamentos da empresa
- `user_notification_settings` - Configurações de notificação dos usuários
- `ticket_attachments` - Anexos dos tickets
- `email_templates` - Templates de email
- `ai_configurations` - Configurações de IA
- `ai_analysis_history` - Histórico de análises de IA
- `ticket_types` - Tipos de tickets

**Novos Enums**:
- `email_template_type` - Tipos de templates de email
- `ai_provider` - Provedores de IA (OpenAI, Google, Anthropic)

**Índices Criados**:
- Índices de performance para todas as tabelas principais
- Índices para chaves estrangeiras e colunas frequentemente consultadas

## 🚀 Como Usar

### Execução Automática
As migrações são executadas automaticamente na inicialização do servidor.

### Execução Manual

```bash
# Executar todas as migrações pendentes
npm run migrate:up

# Ver status das migrações
npm run migrate:status

# Reverter última migração (CUIDADO!)
npm run migrate:down

# Ver ajuda
npm run migrate:help
```

### Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run migrate:up` | Executa todas as migrações pendentes |
| `npm run migrate:down` | Reverte a última migração executada |
| `npm run migrate:status` | Lista o status de todas as migrações |
| `npm run migrate:help` | Mostra ajuda dos comandos |

## 📁 Estrutura dos Arquivos

```
server/migrations/
├── README.md                           # Esta documentação
├── 20241228-fix-database-structure.ts  # Migração principal
└── [futuras-migrações].ts              # Futuras migrações
```

## 🔧 Como Criar Nova Migração

1. **Criar arquivo**: `YYYYMMDD-nome-da-migracao.ts`
2. **Implementar funções**:
   ```typescript
   export async function up() {
     // Código para aplicar a migração
   }
   
   export async function down() {
     // Código para reverter a migração
   }
   ```
3. **Adicionar no runner**: Incluir no array `migrations` em `migration-runner.ts`

## ⚠️ Avisos Importantes

### Backup
**SEMPRE** faça backup do banco antes de executar migrações em produção:
```bash
pg_dump -h hostname -U username -d database_name > backup.sql
```

### Reversão
- Use `npm run migrate:down` com **EXTREMO CUIDADO**
- Reversões podem causar perda de dados
- Teste sempre em ambiente de desenvolvimento primeiro

### Produção
- Migrações são executadas automaticamente na inicialização
- Em caso de erro, o servidor não iniciará
- Monitore logs durante deploys

## 🔍 Troubleshooting

### Erro: "Migração já executada"
```bash
# Verificar status
npm run migrate:status

# Se necessário, reverter e executar novamente
npm run migrate:down
npm run migrate:up
```

### Erro: "Constraint já existe"
As migrações são idempotentes e verificam se objetos já existem antes de criá-los.

### Erro: "Tabela não encontrada"
Verifique se as migrações anteriores foram executadas:
```bash
npm run migrate:status
```

## 📊 Monitoramento

### Tabela de Controle
As migrações são rastreadas na tabela `migrations`:
```sql
SELECT * FROM migrations ORDER BY executed_at DESC;
```

### Logs
Todas as operações são logadas com emojis para fácil identificação:
- 🔧 Início da migração
- 📝 Operações específicas
- ✅ Sucesso
- ❌ Erro

## 🔄 Fluxo de Desenvolvimento

1. **Desenvolvimento**: Criar e testar migração localmente
2. **Commit**: Incluir migração no controle de versão
3. **Deploy**: Migração executa automaticamente
4. **Verificação**: Confirmar sucesso via logs ou `migrate:status`

## 📞 Suporte

Em caso de problemas com migrações:
1. Verificar logs do servidor
2. Executar `npm run migrate:status`
3. Consultar esta documentação
4. Fazer backup antes de qualquer correção manual 