# API de Notificações - Documentação

## Visão Geral

A API de notificações fornece endpoints para gerenciar notificações persistentes, incluindo listagem, marcação como lida, exclusão e gerenciamento de push subscriptions.

## Autenticação

Todos os endpoints requerem autenticação via sessão. O usuário deve estar logado no sistema.

## Endpoints

### 1. Listar Notificações

```http
GET /api/notifications
```

Lista as notificações do usuário autenticado com suporte a paginação e filtros.

#### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|---------|-----------|
| `page` | number | Não | 1 | Página atual (inicia em 1) |
| `limit` | number | Não | 20 | Número de notificações por página (máx: 100) |
| `type` | string | Não | - | Filtrar por tipo de notificação |
| `read` | boolean | Não | - | Filtrar por status de leitura |
| `startDate` | string | Não | - | Data inicial (ISO 8601) |
| `endDate` | string | Não | - | Data final (ISO 8601) |
| `search` | string | Não | - | Busca textual em título e mensagem |

#### Tipos de Notificação Válidos

- `new_ticket` - Novo chamado criado
- `status_change` - Mudança de status do chamado
- `new_reply` - Nova resposta no chamado
- `participant_added` - Participante adicionado ao chamado
- `participant_removed` - Participante removido do chamado
- `ticket_escalated` - Chamado escalado
- `ticket_due_soon` - Chamado próximo do vencimento
- `new_customer` - Novo cliente cadastrado
- `new_user` - Novo usuário cadastrado
- `system_maintenance` - Manutenção do sistema

#### Exemplo de Requisição

```http
GET /api/notifications?page=1&limit=10&type=new_ticket&read=false
```

#### Resposta de Sucesso (200)

```json
{
  "notifications": [
    {
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
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 50,
  "unreadCount": 15,
  "page": 1,
  "limit": 10,
  "hasMore": true
}
```

### 2. Obter Contador de Não Lidas

```http
GET /api/notifications/unread-count
```

Retorna o número de notificações não lidas do usuário.

#### Resposta de Sucesso (200)

```json
{
  "count": 15
}
```

### 3. Marcar Notificação como Lida

```http
PATCH /api/notifications/:id/read
```

Marca uma notificação específica como lida.

#### Parâmetros de URL

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | number | ID da notificação |

#### Resposta de Sucesso (200)

```json
{
  "success": true,
  "unreadCount": 14
}
```

#### Erros Possíveis

- `404` - Notificação não encontrada ou não pertence ao usuário
- `400` - ID inválido

### 4. Marcar Todas como Lidas

```http
PATCH /api/notifications/read-all
```

Marca todas as notificações não lidas do usuário como lidas.

#### Resposta de Sucesso (200)

```json
{
  "success": true,
  "unreadCount": 0,
  "updatedCount": 15
}
```

### 5. Excluir Notificação

```http
DELETE /api/notifications/:id
```

Exclui uma notificação específica permanentemente.

#### Parâmetros de URL

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | number | ID da notificação |

#### Resposta de Sucesso (200)

```json
{
  "success": true
}
```

#### Erros Possíveis

- `404` - Notificação não encontrada ou não pertence ao usuário
- `400` - ID inválido

### 6. Excluir Múltiplas Notificações

```http
DELETE /api/notifications
```

Exclui múltiplas notificações em uma única operação.

#### Corpo da Requisição

```json
{
  "ids": [123, 124, 125]
}
```

#### Resposta de Sucesso (200)

```json
{
  "success": true,
  "deletedCount": 3
}
```

#### Erros Possíveis

- `400` - Array de IDs inválido ou vazio (máximo 100 IDs)
- `403` - Tentativa de excluir notificações de outros usuários

## Web Push Subscriptions

### 7. Registrar Push Subscription

```http
POST /api/notifications/push/subscribe
```

Registra uma nova push subscription para o usuário.

#### Corpo da Requisição

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNbRAG...",
    "auth": "tBHItJ..."
  }
}
```

#### Resposta de Sucesso (201)

```json
{
  "success": true,
  "message": "Push subscription registrada com sucesso"
}
```

#### Erros Possíveis

- `400` - Dados de subscription inválidos
- `409` - Subscription já existe para este usuário

### 8. Remover Push Subscription

```http
POST /api/notifications/push/unsubscribe
```

Remove uma push subscription existente.

#### Corpo da Requisição

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

#### Resposta de Sucesso (200)

```json
{
  "success": true,
  "message": "Push subscription removida com sucesso"
}
```

### 9. Obter Chave Pública VAPID

```http
GET /api/notifications/push/public-key
```

Retorna a chave pública VAPID necessária para registrar push subscriptions.

#### Resposta de Sucesso (200)

```json
{
  "publicKey": "BAnG9uum3bgKZNm9cPV19KLY0HFW6i3An6PXaW0INaenLhXjaKx4gixzX3rIq_d_K7praKBRRh3Htx1wGYzTwxc"
}
```

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Dados inválidos |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 409 | Conflito (recurso já existe) |
| 500 | Erro interno do servidor |

## Limites e Restrições

- **Paginação**: Máximo 100 notificações por página
- **Exclusão em lote**: Máximo 100 notificações por operação
- **Push subscriptions**: Máximo 5 subscriptions ativas por usuário
- **Retenção**: Notificações lidas são mantidas por 90 dias, não lidas por 180 dias

## Exemplos de Uso

### Carregar notificações com filtros

```javascript
// Buscar notificações não lidas de chamados
const response = await fetch('/api/notifications?read=false&type=new_ticket&limit=20');
const data = await response.json();

console.log(`${data.unreadCount} notificações não lidas`);
data.notifications.forEach(notification => {
  console.log(`${notification.title}: ${notification.message}`);
});
```

### Marcar notificação como lida ao clicar

```javascript
async function markAsRead(notificationId) {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH'
  });
  
  const data = await response.json();
  if (data.success) {
    updateUnreadCounter(data.unreadCount);
  }
}
```

### Registrar para push notifications

```javascript
async function subscribeToPush() {
  // Obter chave pública VAPID
  const keyResponse = await fetch('/api/notifications/push/public-key');
  const { publicKey } = await keyResponse.json();
  
  // Registrar service worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  
  // Criar subscription
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey
  });
  
  // Enviar para o servidor
  await fetch('/api/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });
}
```

## WebSocket Events

Além da API REST, o sistema também envia atualizações em tempo real via WebSocket:

### Eventos Recebidos

- `notification` - Nova notificação recebida
- `notification_count_update` - Contador de não lidas atualizado
- `notification_read` - Notificação marcada como lida
- `notification_deleted` - Notificação excluída

### Exemplo de Uso WebSocket

```javascript
// Escutar notificações em tempo real
websocket.on('notification', (notification) => {
  displayNotification(notification);
  updateUnreadCounter(notification.unreadCount);
});

websocket.on('notification_count_update', (data) => {
  updateUnreadCounter(data.count);
});
```