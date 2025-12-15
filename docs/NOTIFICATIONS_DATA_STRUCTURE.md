# Estrutura de Dados - Sistema de Notificações

## Visão Geral

Este documento descreve a estrutura de dados do sistema de notificações, incluindo tabelas do banco de dados, tipos TypeScript e formatos de dados utilizados.

## Tabelas do Banco de Dados

### Tabela `notifications`

Armazena todas as notificações do sistema com histórico completo.

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  
  -- Metadados opcionais para contexto
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_code TEXT,
  
  -- Metadados adicionais em JSON
  metadata JSONB,
  
  -- Controle de leitura
  read_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Índices

```sql
-- Índice principal para consultas por usuário
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Índice para consultas de não lidas
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);

-- Índice para ordenação por data
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Índice para filtros por tipo
CREATE INDEX idx_notifications_type ON notifications(type);

-- Índice para limpeza automática
CREATE INDEX idx_notifications_cleanup ON notifications(read_at, created_at);
```

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | SERIAL | Sim | Identificador único da notificação |
| `user_id` | INTEGER | Sim | ID do usuário destinatário |
| `type` | TEXT | Sim | Tipo da notificação (enum) |
| `title` | TEXT | Sim | Título da notificação |
| `message` | TEXT | Sim | Mensagem da notificação |
| `priority` | TEXT | Sim | Prioridade (low, medium, high, critical) |
| `ticket_id` | INTEGER | Não | ID do chamado relacionado |
| `ticket_code` | TEXT | Não | Código do chamado (ex: TK-001) |
| `metadata` | JSONB | Não | Dados adicionais em formato JSON |
| `read_at` | TIMESTAMP | Não | Data/hora da leitura (NULL = não lida) |
| `created_at` | TIMESTAMP | Sim | Data/hora de criação |

### Tabela `push_subscriptions`

Armazena as subscriptions de Web Push dos usuários.

```sql
CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dados da subscription do navegador
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  
  -- Metadados
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);
```

#### Índices

```sql
-- Índice único para endpoint
CREATE UNIQUE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Índice para consultas por usuário
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | SERIAL | Sim | Identificador único da subscription |
| `user_id` | INTEGER | Sim | ID do usuário proprietário |
| `endpoint` | TEXT | Sim | URL do endpoint de push (único) |
| `p256dh_key` | TEXT | Sim | Chave pública P256DH |
| `auth_key` | TEXT | Sim | Chave de autenticação |
| `user_agent` | TEXT | Não | User agent do navegador |
| `created_at` | TIMESTAMP | Sim | Data/hora de criação |
| `last_used_at` | TIMESTAMP | Não | Última vez que foi usada |

## Tipos TypeScript

### Notification

```typescript
interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  ticketId?: number;
  ticketCode?: string;
  metadata?: NotificationMetadata;
  readAt?: Date;
  createdAt: Date;
}
```

### NotificationType

```typescript
type NotificationType = 
  | 'new_ticket'           // Novo chamado criado
  | 'status_change'        // Mudança de status do chamado
  | 'new_reply'           // Nova resposta no chamado
  | 'participant_added'    // Participante adicionado ao chamado
  | 'participant_removed'  // Participante removido do chamado
  | 'ticket_escalated'     // Chamado escalado
  | 'ticket_due_soon'      // Chamado próximo do vencimento
  | 'new_customer'         // Novo cliente cadastrado
  | 'new_user'            // Novo usuário cadastrado
  | 'system_maintenance';  // Manutenção do sistema
```

### NotificationPriority

```typescript
type NotificationPriority = 
  | 'low'      // Baixa prioridade
  | 'medium'   // Prioridade média (padrão)
  | 'high'     // Alta prioridade
  | 'critical'; // Prioridade crítica
```

### NotificationMetadata

```typescript
interface NotificationMetadata {
  // Para notificações de chamado
  customerName?: string;
  departmentId?: number;
  departmentName?: string;
  assignedToId?: number;
  assignedToName?: string;
  
  // Para mudanças de status
  oldStatus?: string;
  newStatus?: string;
  
  // Para participantes
  participantId?: number;
  participantName?: string;
  participantEmail?: string;
  action?: 'added' | 'removed';
  
  // Para escalação
  escalatedFrom?: string;
  escalatedTo?: string;
  reason?: string;
  
  // Metadados customizados
  [key: string]: any;
}
```

### PushSubscription

```typescript
interface PushSubscription {
  id: number;
  userId: number;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string;
  createdAt: Date;
  lastUsedAt?: Date;
}
```

### NotificationPayload

```typescript
interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  ticketId?: number;
  ticketCode?: string;
  timestamp: Date;
  priority?: NotificationPriority;
  metadata?: NotificationMetadata;
}
```

### API Response Types

#### NotificationList

```typescript
interface NotificationList {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

#### GetNotificationsOptions

```typescript
interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  type?: NotificationType;
  read?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}
```

#### PushSubscriptionData

```typescript
interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
```

## Formatos de Dados

### WebSocket Events

#### Evento: `notification`

```json
{
  "type": "notification",
  "data": {
    "id": 123,
    "userId": 456,
    "type": "new_ticket",
    "title": "Novo Chamado #TK-001",
    "message": "Um novo chamado foi criado por João Silva",
    "priority": "medium",
    "ticketId": 789,
    "ticketCode": "TK-001",
    "metadata": {
      "customerName": "João Silva",
      "departmentId": 1
    },
    "readAt": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "unreadCount": 15
  }
}
```

#### Evento: `notification_count_update`

```json
{
  "type": "notification_count_update",
  "data": {
    "count": 14,
    "userId": 456
  }
}
```

### Web Push Payload

```json
{
  "title": "Novo Chamado #TK-001",
  "message": "Um novo chamado foi criado por João Silva",
  "id": 123,
  "priority": "medium",
  "ticketId": 789,
  "ticketCode": "TK-001",
  "url": "/tickets/789",
  "icon": "/logo_muda.png",
  "badge": "/pwa-96x96.png",
  "timestamp": 1705312200000
}
```

## Exemplos de Metadados por Tipo

### new_ticket

```json
{
  "customerName": "João Silva",
  "customerEmail": "joao@empresa.com",
  "departmentId": 1,
  "departmentName": "Suporte Técnico",
  "priority": "high",
  "category": "Hardware"
}
```

### status_change

```json
{
  "oldStatus": "open",
  "newStatus": "in_progress",
  "changedBy": "Maria Santos",
  "changedById": 789,
  "reason": "Iniciando análise do problema"
}
```

### new_reply

```json
{
  "authorName": "Carlos Oliveira",
  "authorId": 456,
  "authorType": "customer",
  "hasAttachments": true,
  "attachmentCount": 2
}
```

### participant_added

```json
{
  "participantId": 321,
  "participantName": "Ana Costa",
  "participantEmail": "ana@empresa.com",
  "participantRole": "observer",
  "addedBy": "Supervisor",
  "addedById": 654
}
```

### ticket_escalated

```json
{
  "escalatedFrom": "Nível 1",
  "escalatedTo": "Nível 2",
  "escalatedBy": "Sistema Automático",
  "reason": "SLA próximo do vencimento",
  "previousAssignee": "João Suporte",
  "newAssignee": "Maria Especialista"
}
```

## Validações e Restrições

### Validações de Dados

- `type`: Deve ser um dos valores válidos do enum `NotificationType`
- `priority`: Deve ser um dos valores válidos do enum `NotificationPriority`
- `title`: Máximo 255 caracteres, não pode ser vazio
- `message`: Máximo 1000 caracteres, não pode ser vazio
- `ticket_code`: Formato TK-XXXXXX (se fornecido)
- `metadata`: JSON válido, máximo 5KB

### Restrições de Negócio

- Usuário só pode acessar suas próprias notificações
- Máximo 100 notificações por página na API
- Máximo 100 notificações por operação de exclusão em lote
- Máximo 5 push subscriptions ativas por usuário
- Notificações lidas são mantidas por 90 dias
- Notificações não lidas são mantidas por 180 dias

### Índices de Performance

Os índices foram criados para otimizar as consultas mais comuns:

1. **Listagem por usuário**: `(user_id, created_at DESC)`
2. **Contagem de não lidas**: `(user_id, read_at)`
3. **Filtros por tipo**: `(type, user_id)`
4. **Limpeza automática**: `(read_at, created_at)`
5. **Push subscriptions**: `(endpoint UNIQUE)`, `(user_id)`

## Migração de Dados

### Script de Migração

```sql
-- Migration 074: Add notifications system
-- Arquivo: db/migrations/074_add_notifications_system.sql

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_code TEXT,
  metadata JSONB,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup ON notifications(read_at, created_at);

-- Criar tabela de push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Criar índices para push subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

### Verificação de Integridade

```sql
-- Verificar se as tabelas foram criadas corretamente
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('notifications', 'push_subscriptions')
ORDER BY table_name, ordinal_position;

-- Verificar índices
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('notifications', 'push_subscriptions');
```