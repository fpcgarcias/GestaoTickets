# Changelog - Sistema de Gestão de Tickets

## [2024-12-29] - Implementações de Performance

### ✨ Novas Funcionalidades

#### Coluna de Empresa na Tela de Usuários
- Adicionada coluna "Empresa" na tela de gerenciamento de usuários
- Visível apenas para usuários com role "admin"
- Mostra a empresa associada a cada usuário ou "Sistema Global" para usuários sem empresa
- Backend atualizado para incluir dados da empresa nas consultas de usuários

#### Sistema de Logging Profissional
- Implementado Winston Logger com níveis estruturados (error, warn, info, debug)
- Rotação automática de logs diários com `winston-daily-rotate-file`
- Logs em formato JSON para melhor análise
- Configuração diferenciada por ambiente (dev/prod)

#### Middleware de Performance
- Monitoramento automático de tempo de resposta
- Tracking de uso de memória por requisição
- Detecção de requisições lentas (>1000ms)
- Endpoint `/api/performance/stats` para métricas em tempo real

#### React Query Otimizado
- Cache inteligente com estratégias por tipo de dados:
  - Realtime: 30s (tickets, notificações)
  - Dynamic: 5min (usuários, clientes)
  - Static: 30min (configurações, departamentos)
  - Immutable: 24h (dados históricos)
- Query keys padronizadas
- Prefetch automático de dados críticos

#### Build Otimizado (Vite)
- Code splitting manual por categorias
- Tree shaking agressivo
- Assets inline para arquivos pequenos
- Compressão Gzip e Brotli

### 🗄️ Banco de Dados

#### Índices de Performance Implementados
- `idx_tickets_status_priority` - Consultas por status e prioridade
- `idx_tickets_company_status` - Tickets por empresa e status
- `idx_tickets_assigned_status` - Tickets atribuídos por status
- `idx_tickets_created_desc` - Ordenação temporal descendente
- `idx_tickets_company_created` - Tickets por empresa ordenados por data
- `idx_tickets_department_status` - Tickets por departamento e status
- `idx_ticket_replies_ticket_created` - Respostas por ticket ordenadas
- `idx_ticket_replies_user_created` - Respostas por usuário ordenadas
- `idx_users_email_active` - Busca de usuários ativos por email
- `idx_users_username_active` - Busca de usuários ativos por username
- `idx_users_company_role` - Usuários por empresa e role
- `idx_customers_email` - Busca de clientes por email
- `idx_customers_company_created` - Clientes por empresa ordenados
- `idx_officials_company_active` - Atendentes ativos por empresa
- `idx_officials_user_id` - Busca de atendentes por user_id
- `idx_departments_company_active` - Departamentos ativos por empresa
- `idx_incident_types_company_active` - Tipos de incidente ativos por empresa
- `idx_incident_types_global_active` - Tipos de incidente globais ativos
- `idx_ticket_attachments_ticket_active` - Anexos ativos por ticket
- `idx_ticket_status_history_ticket_created` - Histórico de status por ticket
- `idx_sla_definitions_company_priority` - Definições SLA por empresa e prioridade

#### Correções de Schema
- Corrigido enum `ticket_status`: `['new', 'ongoing', 'resolved']`
- Corrigido enum `ticket_priority`: `['low', 'medium', 'high', 'critical']`
- Mantido enum `user_role` com todos os roles existentes

### 📦 Dependências Adicionadas
```json
{
  "winston": "^3.17.0",
  "winston-daily-rotate-file": "^5.0.0"
}
```

### 🚀 Melhorias de Performance Esperadas
- **Time to First Byte**: 800ms → 200ms (75% redução)
- **Database Query Time**: 300ms → 50ms (83% redução)
- **Bundle Size**: 2.5MB → 1MB (60% redução)
- **Memory Usage**: 150MB → 80MB (47% redução)
- **Cache Hit Rate**: 0% → 85%

### 📁 Arquivos Criados/Modificados
- `server/services/logger.ts` - Sistema de logging profissional
- `server/middleware/performance.ts` - Middleware de performance
- `server/migrations/20241229-performance-indexes.ts` - Migração de índices
- `client/src/lib/query-client.ts` - React Query otimizado
- `vite.config.ts` - Build otimizado
- `server/routes.ts` - Integração dos middlewares
- `server/migration-runner.ts` - Atualizado com nova migração
- `server/migrate.ts` - Atualizado com nova migração
- `.cursor/rules/db-typing.mdc` - Documentação atualizada
- `PERFORMANCE_ANALYSIS.md` - Análise técnica completa
- `PERFORMANCE_SUMMARY.md` - Resumo executivo

### 🔧 Configurações
- Logging configurado para diferentes ambientes
- Cache strategies implementadas
- Performance monitoring ativo
- Índices de banco otimizados

---

## Funcionalidades Anteriores

### [2024-12-28] - Coluna de Empresa para Admins
- Adicionada coluna "Empresa" na tela de tipos de chamados
- Visível apenas para usuários com role "admin"
- Migração para campo `description` em `incident_types`

### [2024-12-27] - Estrutura Base
- Sistema de gestão de tickets implementado
- Autenticação e autorização
- Multi-tenancy com empresas
- Sistema de departamentos e atendentes 