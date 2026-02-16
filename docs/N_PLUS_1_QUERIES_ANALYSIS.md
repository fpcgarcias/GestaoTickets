# Análise de N+1 Queries - GestaoTickets

> **Data da Análise:** 12 de Fevereiro de 2026  
> **Stack:** Express.js + Drizzle ORM + PostgreSQL  
> **Total de ocorrências encontradas:** 13 padrões N+1 em 6 arquivos

---

## Índice

1. [Resumo Executivo](#resumo-executivo)
2. [O que é N+1 Query?](#o-que-é-n1-query)
3. [Problemas Identificados](#problemas-identificados)
   - [CRÍTICO] #1 — `getTickets()` — N+1 triplo aninhado
   - [ALTO] #2 — `getTicketsByStatus/CustomerId/OfficialId` — Requery por ID
   - [ALTO] #3 — `getRecentTickets()` — Requery por ID
   - [ALTO] #4 — `getTicketReplies()` — User fetch por reply
   - [MÉDIO] #5 — `getCategoriesPaginated()` — Enriquecimento individual
   - [MÉDIO] #6 — `getTicketsByCategory()` — Customer fetch por ticket
   - [MÉDIO] #7 — Departamentos de subordinados (Manager/Supervisor)
   - [ALTO] #8 — Enriquecimento de clientes com dados de usuário
   - [ALTO] #9 — Métricas por atendente nos relatórios
   - [ALTO] #10 — Métricas por departamento nos relatórios
   - [BAIXO] #11 — Validação de usuários em participantes
   - [MÉDIO] #12 — Digest de participantes por ticket
   - [ALTO] #13 — Verificação de SLA breach (scheduler)
4. [Tabela Resumo](#tabela-resumo)
5. [Priorização Recomendada](#priorização-recomendada)
6. [Estimativa de Impacto Global](#estimativa-de-impacto-global)

---

## Resumo Executivo

Foram identificados **13 padrões de N+1 queries** distribuídos em 6 arquivos do servidor. Os problemas mais críticos estão concentrados em `database-storage.ts` (6 ocorrências), `routes.ts` (2 ocorrências), `routes/reports.ts` (2 ocorrências) e `services/email-notification-service.ts` (2 ocorrências).

**Impacto estimado:** Em um cenário com 100 tickets, o sistema pode executar **mais de 600 queries** em uma única chamada de API, quando deveria executar entre 1 e 5 queries. A correção dos 5 problemas mais críticos pode reduzir o número de queries em **até 95%** e o tempo de resposta da API em **60-80%**.

---

## O que é N+1 Query?

O problema de N+1 query ocorre quando o código executa:
- **1 query** para buscar uma lista de N itens
- **N queries adicionais** para buscar dados relacionados de cada item individualmente

**Exemplo problemático:**
```typescript
// 1 query para buscar tickets
const tickets = await db.select().from(tickets);

// N queries adicionais (1 por ticket)
for (const ticket of tickets) {
  const customer = await db.select().from(customers)
    .where(eq(customers.id, ticket.customer_id)); // ❌ Query dentro do loop
}
```

**Solução correta:**
```typescript
// 1 única query com JOIN
const tickets = await db.select()
  .from(tickets)
  .leftJoin(customers, eq(customers.id, tickets.customer_id)); // ✅ Uma query só
```

---

## Problemas Identificados

---

### #1 — `getTickets()` — N+1 Triplo Aninhado 🔴 CRÍTICO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 875–928  
**Severidade:** CRÍTICA  

#### Código Atual

```typescript
// server/database-storage.ts — linhas 875-928
async getTickets(): Promise<Ticket[]> {
  const ticketsData = await db.select().from(tickets); // 1 query

  const enrichedTickets = await Promise.all(
    ticketsData.map(async (ticket) => {
      // ❌ N+1 #1: Query por customer para CADA ticket
      if (ticket.customer_id) {
        [customerData] = await db.select().from(customers)
          .where(eq(customers.id, ticket.customer_id));
      }

      // ❌ N+1 #2: Query por official para CADA ticket
      if (ticket.assigned_to_id) {
        [officialData] = await db.select().from(officials)
          .where(eq(officials.id, ticket.assigned_to_id));

        if (officialData) {
          // ❌ N+1 #3: Query por departamentos do official
          const officialDepartmentsData = await db.select()
            .from(officialDepartments)
            .where(eq(officialDepartments.official_id, officialData.id));

          // ❌ N+1 #4: Query por CADA departamento (N+1 dentro de N+1!)
          const departmentNames = await Promise.all(
            departmentIds.map(async (deptId) => {
              const [dept] = await db.select({ name: departments.name })
                .from(departments)
                .where(eq(departments.id, deptId));
              return dept?.name;
            })
          );
        }
      }

      // ❌ N+1 #5: Query de replies para CADA ticket (que internamente tem outro N+1)
      const replies = await this.getTicketReplies(ticket.id);

      return { ...ticket, customer: customerData, official: officialData, replies };
    })
  );
}
```

#### Impacto

Para **100 tickets** com média de 2 departamentos por atendente:

| Operação | Queries |
|----------|---------|
| Buscar todos os tickets | 1 |
| Buscar customer por ticket | 100 |
| Buscar official por ticket | 100 |
| Buscar departamentos do official | 100 |
| Buscar nome de cada departamento | 200 |
| Buscar replies por ticket (getTicketReplies) | 100 |
| Buscar user por reply (N+1 dentro de getTicketReplies) | ~500+ |
| **TOTAL** | **~1.100+ queries** |

#### Sugestão de Correção

```typescript
async getTickets(): Promise<Ticket[]> {
  // 1 única query com JOINs (similar ao getTicketInternal que já existe!)
  const ticketsData = await db.select({
    // ...campos do ticket, customer, official, department, etc.
  })
  .from(tickets)
  .leftJoin(customers, eq(customers.id, tickets.customer_id))
  .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
  .leftJoin(departments, eq(departments.id, tickets.department_id));

  // Buscar departamentos dos officials em batch
  const officialIds = [...new Set(ticketsData.map(t => t.assigned_to_id).filter(Boolean))];
  const allOfficialDepts = await db.select()
    .from(officialDepartments)
    .innerJoin(departments, eq(departments.id, officialDepartments.department_id))
    .where(inArray(officialDepartments.official_id, officialIds));

  // Buscar replies em batch (com user JOIN)
  const ticketIds = ticketsData.map(t => t.id);
  const allReplies = await db.select()
    .from(ticketReplies)
    .leftJoin(users, eq(users.id, ticketReplies.user_id))
    .where(inArray(ticketReplies.ticket_id, ticketIds));

  // Montar em memória (0 queries adicionais)
  // ...
}
```

**Impacto esperado:** De ~1.100 queries para **3 queries**. Redução de **99.7%** no número de queries.

---

### #2 — `getTicketsByStatus/CustomerId/OfficialId` — Requery por ID 🔴 ALTO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 1100–1137  
**Severidade:** ALTA  

#### Código Atual

```typescript
// server/database-storage.ts — linhas 1100-1137
async getTicketsByStatus(status: string): Promise<Ticket[]> {
  // Query 1: busca tickets filtrados
  const ticketsData = await db.select().from(tickets)
    .where(eq(tickets.status, status as any));

  // ❌ N queries: busca cada ticket de novo com getTicketInternal (que faz 5 JOINs)
  const enrichedTickets = await Promise.all(
    ticketsData.map(ticket => this.getTicketInternal(ticket.id))
  );
  return enrichedTickets.filter(Boolean) as Ticket[];
}

// Mesmo padrão se repete em:
// - getTicketsByCustomerId (linha 1113)
// - getTicketsByOfficialId (linha 1126)
```

#### Impacto

Os dados do primeiro `select()` são **completamente descartados**, e `getTicketInternal` refaz a busca por ID com 5 LEFT JOINs para cada ticket. Para 50 tickets, são **51 queries** (1 + 50) quando deveria ser **1 query**.

#### Sugestão de Correção

```typescript
async getTicketsByStatus(status: string): Promise<Ticket[]> {
  // Aplicar JOINs diretamente na query filtrada (reutilizar lógica de getTicketInternal)
  const results = await db.select({
    // ...mesmos campos de getTicketInternal
  })
  .from(tickets)
  .leftJoin(customers, eq(customers.id, tickets.customer_id))
  .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
  .leftJoin(departments, eq(departments.id, tickets.department_id))
  .leftJoin(incidentTypes, eq(incidentTypes.id, tickets.incident_type_id))
  .leftJoin(categories, eq(categories.id, tickets.category_id))
  .where(eq(tickets.status, status as any));

  return results.map(result => this.mapTicketResult(result));
}
```

**Impacto esperado:** De N+1 queries para **1 query**. Redução de **98%** no número de queries.

---

### #3 — `getRecentTickets()` — Requery por ID 🔴 ALTO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 1600–1617  
**Severidade:** ALTA  

#### Código Atual

```typescript
// server/database-storage.ts — linhas 1600-1617
async getRecentTickets(limit: number = 10): Promise<Ticket[]> {
  const recentTickets = await db.select().from(tickets)
    .orderBy(desc(tickets.created_at))
    .limit(limit); // Query 1

  // ❌ N queries: getTicketInternal para cada ticket
  const enrichedTickets = await Promise.all(
    recentTickets.map(ticket => this.getTicketInternal(ticket.id))
  );
  return enrichedTickets.filter(Boolean) as Ticket[];
}
```

#### Impacto

Para o default de 10 tickets: **11 queries** (1 + 10).

#### Sugestão de Correção

```typescript
async getRecentTickets(limit: number = 10): Promise<Ticket[]> {
  const results = await db.select({ /* campos com JOINs */ })
    .from(tickets)
    .leftJoin(customers, eq(customers.id, tickets.customer_id))
    .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
    .leftJoin(departments, eq(departments.id, tickets.department_id))
    .leftJoin(incidentTypes, eq(incidentTypes.id, tickets.incident_type_id))
    .leftJoin(categories, eq(categories.id, tickets.category_id))
    .orderBy(desc(tickets.created_at))
    .limit(limit);

  return results.map(result => this.mapTicketResult(result));
}
```

**Impacto esperado:** De 11 queries para **1 query**. Redução de **91%**.

---

### #4 — `getTicketReplies()` — User fetch por reply 🔴 ALTO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 1246–1272  
**Severidade:** ALTA (efeito cascata quando chamado de `getTickets()`)

#### Código Atual

```typescript
// server/database-storage.ts — linhas 1246-1272
async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
  const replies = await db.select().from(ticketReplies)
    .where(eq(ticketReplies.ticket_id, ticketId))
    .orderBy(ticketReplies.created_at); // Query 1

  // ❌ N queries: buscar user para cada reply
  const enrichedReplies = await Promise.all(
    replies.map(async (reply) => {
      if (reply.user_id) {
        const [user] = await db.select().from(users)
          .where(eq(users.id, reply.user_id)); // 1 query por reply
        return { ...reply, user: user || undefined };
      }
      return reply;
    })
  );
  return enrichedReplies;
}
```

#### Impacto

Para um ticket com 20 replies: **21 queries**. Quando chamado por `getTickets()` para 100 tickets: **~2.100 queries** adicionais.

#### Sugestão de Correção

```typescript
async getTicketReplies(ticketId: number): Promise<TicketReply[]> {
  // 1 query com LEFT JOIN
  const results = await db.select({
    reply: ticketReplies,
    user: users,
  })
  .from(ticketReplies)
  .leftJoin(users, eq(users.id, ticketReplies.user_id))
  .where(eq(ticketReplies.ticket_id, ticketId))
  .orderBy(ticketReplies.created_at);

  return results.map(r => ({
    ...r.reply,
    user: r.user || undefined,
  }));
}
```

**Impacto esperado:** De N+1 queries para **1 query** por chamada. Quando em batch (getTickets), usar `inArray` para buscar todas as replies de todos os tickets de uma vez.

---

### #5 — `getCategoriesPaginated()` — Enriquecimento individual 🟡 MÉDIO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 1849–1876  
**Severidade:** MÉDIA  

#### Código Atual

```typescript
// server/database-storage.ts — linhas 1849-1876
const enrichedCategories = await Promise.all(
  categoriesData.map(async (category) => {
    let incidentType = undefined;
    let company = undefined;

    // ❌ Query por incidentType para CADA categoria
    if (category.incident_type_id) {
      const [incident] = await db.select().from(incidentTypes)
        .where(eq(incidentTypes.id, category.incident_type_id));
      incidentType = incident || undefined;
    }

    // ❌ Query por company para CADA categoria
    if (category.company_id) {
      const [comp] = await db.select().from(companies)
        .where(eq(companies.id, category.company_id));
      company = comp || undefined;
    }

    return { ...category, incident_type: incidentType, company };
  })
);
```

#### Impacto

Para 50 categorias: **até 101 queries** (1 + 50 + 50).

#### Sugestão de Correção

```typescript
// Usar LEFT JOINs na query original
const categoriesData = await db.select({
  category: categories,
  incidentType: incidentTypes,
  company: companies,
})
.from(categories)
.leftJoin(incidentTypes, eq(incidentTypes.id, categories.incident_type_id))
.leftJoin(companies, eq(companies.id, categories.company_id))
.orderBy(categories.name)
.limit(limit)
.offset((page - 1) * limit);
```

**Impacto esperado:** De ~101 queries para **1 query**. Redução de **99%**.

---

### #6 — `getTicketsByCategory()` — Customer fetch por ticket 🟡 MÉDIO

**Arquivo:** `server/database-storage.ts`  
**Linhas:** 1996–2022  
**Severidade:** MÉDIA  

#### Código Atual

```typescript
// server/database-storage.ts — linhas 1996-2017
async getTicketsByCategory(categoryId: number): Promise<Ticket[]> {
  const ticketsData = await db.select().from(tickets)
    .where(eq(tickets.category_id, categoryId)); // Query 1

  // ❌ N queries: buscar customer para cada ticket
  const enriched = await Promise.all(
    ticketsData.map(async (ticket) => {
      let customerData = {};
      if (ticket.customer_id) {
        [customerData] = await db.select().from(customers)
          .where(eq(customers.id, ticket.customer_id));
      }
      return { ...ticket, customer: customerData || {} };
    })
  );
  return enriched as Ticket[];
}
```

#### Sugestão de Correção

```typescript
async getTicketsByCategory(categoryId: number): Promise<Ticket[]> {
  const results = await db.select()
    .from(tickets)
    .leftJoin(customers, eq(customers.id, tickets.customer_id))
    .where(eq(tickets.category_id, categoryId));
  // Mapear resultados em memória
}
```

**Impacto esperado:** De N+1 queries para **1 query**.

---

### #7 — Departamentos de Subordinados (Manager/Supervisor) 🟡 MÉDIO

**Arquivo:** `server/routes.ts`  
**Linhas:** 1253–1259 (manager), 1357–1363 (supervisor)  
**Severidade:** MÉDIA  

#### Código Atual

```typescript
// server/routes.ts — linhas 1253-1259
// Buscar departamentos dos subordinados para tickets não atribuídos
const allDepartments = new Set<number>();
for (const subordinate of subordinates) {
  // ❌ 1 query por subordinado
  const departments = await db.select()
    .from(schema.officialDepartments)
    .where(eq(schema.officialDepartments.official_id, subordinate.id));
  departments.forEach(dept => allDepartments.add(dept.department_id));
}
```

Este padrão aparece **2 vezes**: uma para o role `manager` (linha 1253) e outra para o role `supervisor` (linha 1357).

#### Sugestão de Correção

```typescript
const subordinateIds = subordinates.map(s => s.id);
// 1 única query com inArray
const allDepts = await db.select()
  .from(schema.officialDepartments)
  .where(inArray(schema.officialDepartments.official_id, subordinateIds));
const allDepartments = new Set(allDepts.map(d => d.department_id));
```

**Impacto esperado:** De N queries para **1 query**.

---

### #8 — Enriquecimento de Clientes com Dados de Usuário 🔴 ALTO

**Arquivo:** `server/routes.ts`  
**Linhas:** 4963–5007  
**Severidade:** ALTA  

#### Código Atual

```typescript
// server/routes.ts — linhas 4963-5007
const enrichedCustomers = await Promise.all(
  limitedCustomers.map(async (customer) => {
    let userData = null;
    if (customer.user_id) {
      // ❌ 1 query por customer
      userData = await storage.getUser(customer.user_id);
    }
    return {
      ...customer,
      active: userData ? userData.active : true,
      user: userData ? { id: userData.id, username: userData.username, ... } : null
    };
  })
);
```

#### Sugestão de Correção

```typescript
// Buscar todos os users relacionados em 1 query
const userIds = limitedCustomers.map(c => c.user_id).filter(Boolean);
const usersData = await db.select().from(users)
  .where(inArray(users.id, userIds));
const usersMap = new Map(usersData.map(u => [u.id, u]));

// Enriquecer em memória (0 queries)
const enrichedCustomers = limitedCustomers.map(customer => {
  const userData = customer.user_id ? usersMap.get(customer.user_id) : null;
  return { ...customer, active: userData?.active ?? true, user: userData };
});
```

**Impacto esperado:** De N queries para **1 query**. Para 50 clientes: de 50 queries para 1.

---

### #9 — Métricas por Atendente nos Relatórios 🔴 ALTO

**Arquivo:** `server/routes/reports.ts`  
**Linhas:** 1306–1351 e 1699–1729  
**Severidade:** ALTA  

#### Código Atual

```typescript
// server/routes/reports.ts — linhas 1306-1351
const officialsMetrics = await Promise.all(
  Array.from(ticketsByOfficial.entries()).map(async ([officialId, ts]) => {
    // ❌ 2 queries por atendente
    const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
      userId, userRole, officialId, startDate, endDate, departmentId
    );
    const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
      userId, userRole, officialId, startDate, endDate, departmentId
    );
    return { official_id: officialId, avgFirstResponseHours, avgResolutionHours, ... };
  })
);
```

Este padrão aparece **2 vezes** no arquivo.

#### Sugestão de Correção

Criar uma nova função no storage que calcule as métricas agrupadas por atendente em uma única query:

```typescript
// Nova função no storage
async getMetricsGroupedByOfficial(
  officialIds: number[], startDate: Date, endDate: Date
): Promise<Map<number, { avgFirstResponse: number; avgResolution: number }>> {
  const results = await db.select({
    official_id: tickets.assigned_to_id,
    avgFirstResponse: avg(/* cálculo */),
    avgResolution: avg(/* cálculo */),
  })
  .from(tickets)
  .where(and(
    inArray(tickets.assigned_to_id, officialIds),
    gte(tickets.created_at, startDate),
    lte(tickets.created_at, endDate)
  ))
  .groupBy(tickets.assigned_to_id);

  return new Map(results.map(r => [r.official_id, r]));
}
```

**Impacto esperado:** De 2N queries para **1 query**. Para 20 atendentes: de 40 queries para 1.

---

### #10 — Métricas por Departamento nos Relatórios 🔴 ALTO

**Arquivo:** `server/routes/reports.ts`  
**Linhas:** 1367–1411 e 2373–2398  
**Severidade:** ALTA  

#### Código Atual

Mesmo padrão do #9, mas agrupado por departamento.

```typescript
// server/routes/reports.ts — linhas 1367-1411
const departmentsMetrics = await Promise.all(
  Array.from(ticketsByDept.entries()).map(async ([deptId, ts]) => {
    // ❌ 2 queries por departamento
    const avgFirstResponseHours = await storage.getAverageFirstResponseTimeByUserRole(
      userId, userRole, undefined, startDate, endDate, deptId
    );
    const avgResolutionHours = await storage.getAverageResolutionTimeByUserRole(
      userId, userRole, undefined, startDate, endDate, deptId
    );
    return { department_id: deptId, avgFirstResponseHours, avgResolutionHours, ... };
  })
);
```

#### Sugestão de Correção

Mesma abordagem do #9: criar `getMetricsGroupedByDepartment()` com `GROUP BY department_id`.

**Impacto esperado:** De 2N queries para **1 query**. Para 10 departamentos: de 20 queries para 1.

---

### #11 — Validação de Usuários em Participantes 🟢 BAIXO

**Arquivo:** `server/routes/ticket-participants.ts`  
**Linhas:** 235–243 e 490–496  
**Severidade:** BAIXA (N geralmente pequeno)

#### Código Atual

```typescript
// server/routes/ticket-participants.ts — linhas 235-243
const usersToAdd = await Promise.all(
  userIds.map(async (userId) => {
    // ❌ 1 query por userId
    const user = await storage.getUser(userId);
    if (!user) throw new Error(`Usuário com ID ${userId} não encontrado`);
    return user;
  })
);
```

#### Sugestão de Correção

```typescript
const usersToAdd = await db.select().from(users)
  .where(inArray(users.id, userIds));
if (usersToAdd.length !== userIds.length) {
  const foundIds = new Set(usersToAdd.map(u => u.id));
  const missing = userIds.filter(id => !foundIds.has(id));
  throw new Error(`Usuários não encontrados: ${missing.join(', ')}`);
}
```

**Impacto esperado:** De N queries para **1 query**. Impacto baixo pois N é geralmente < 5.

---

### #12 — Digest de Participantes por Ticket 🟡 MÉDIO

**Arquivo:** `server/services/email-notification-service.ts`  
**Linhas:** 2993–3009  
**Severidade:** MÉDIA  

#### Código Atual

```typescript
// server/services/email-notification-service.ts — linhas 2993-3009
for (const ticket of activeTickets) {
  // ❌ 1 query por ticket
  const participants = await this.getTicketParticipants(ticket.id);

  for (const participant of participants) {
    // ...build digest map...
  }
}
```

Este padrão aparece **2 vezes** (digest diário e semanal).

#### Sugestão de Correção

```typescript
// Buscar todos os participantes de todos os tickets ativos em 1 query
const ticketIds = activeTickets.map(t => t.id);
const allParticipants = await db.select()
  .from(ticketParticipants)
  .innerJoin(users, eq(users.id, ticketParticipants.user_id))
  .where(inArray(ticketParticipants.ticket_id, ticketIds));

// Agrupar em memória
const participantsByTicket = new Map();
for (const p of allParticipants) {
  const arr = participantsByTicket.get(p.ticket_id) || [];
  arr.push(p);
  participantsByTicket.set(p.ticket_id, arr);
}
```

**Impacto esperado:** De N queries para **1 query**. Roda em scheduler, melhora consistência do background job.

---

### #13 — Verificação de SLA Breach (Scheduler) 🔴 ALTO

**Arquivo:** `server/services/email-notification-service.ts`  
**Linhas:** 2446–2498 e 3767–3789  
**Severidade:** ALTA (roda periodicamente no scheduler)

#### Código Atual

```typescript
// server/services/email-notification-service.ts — linhas 2446-2498
for (const ticket of filteredTickets) {
  // ❌ Query 1: buscar SLA config
  const resolvedSLA = await slaService.getTicketSLA(
    ticket.company_id, ticket.department_id, ticket.incident_type_id,
    ticket.priority, ticket.category_id || undefined
  );

  // ❌ Query 2: buscar histórico de status
  const statusHistory = await db.select()
    .from(ticketStatusHistory)
    .where(eq(ticketStatusHistory.ticket_id, ticket.id));

  // ...cálculos de SLA...
}

// E nas linhas 3767-3789:
for (const row of candidates) {
  // ❌ Query por ticket: buscar status history
  const [enteredRow] = await db.select()
    .from(ticketStatusHistory)
    .where(and(
      eq(ticketStatusHistory.ticket_id, row.id),
      eq(ticketStatusHistory.change_type, 'status'),
      eq(ticketStatusHistory.new_status, 'waiting_customer')
    ))
    .orderBy(desc(ticketStatusHistory.created_at))
    .limit(1);

  // ❌ Query por ticket: buscar customer user_id
  if (row.customer_id) {
    const [c] = await db.select({ user_id: customers.user_id })
      .from(customers)
      .where(eq(customers.id, row.customer_id));
    customer_user_id = c?.user_id ?? null;
  }
}
```

#### Sugestão de Correção

```typescript
// Pré-carregar TODAS as configurações de SLA ativas em memória
const allSlaConfigs = await slaService.getAllActiveSLAConfigs();

// Pré-carregar TODO o histórico de status dos tickets em análise
const ticketIds = filteredTickets.map(t => t.id);
const allStatusHistory = await db.select()
  .from(ticketStatusHistory)
  .where(inArray(ticketStatusHistory.ticket_id, ticketIds));

// Agrupar por ticket_id em memória
const historyByTicket = new Map();
allStatusHistory.forEach(h => {
  const arr = historyByTicket.get(h.ticket_id) || [];
  arr.push(h);
  historyByTicket.set(h.ticket_id, arr);
});

// Pré-carregar customers
const customerIds = [...new Set(filteredTickets.map(t => t.customer_id).filter(Boolean))];
const customersData = await db.select().from(customers)
  .where(inArray(customers.id, customerIds));
const customersMap = new Map(customersData.map(c => [c.id, c]));

// Loop sem queries adicionais
for (const ticket of filteredTickets) {
  const resolvedSLA = allSlaConfigs.find(/* match */);
  const statusHistory = historyByTicket.get(ticket.id) || [];
  const customer = customersMap.get(ticket.customer_id);
  // ...cálculos...
}
```

**Impacto esperado:** De 2-3N queries para **3 queries**. Para 200 tickets abertos: de ~600 queries para 3. Crítico por rodar em background job periódico.

---

## Tabela Resumo

| # | Arquivo | Método | Severidade | Queries Atuais (N itens) | Queries Após Fix | Redução |
|---|---------|--------|------------|--------------------------|-------------------|---------|
| 1 | `database-storage.ts` | `getTickets()` | 🔴 CRÍTICO | ~5N + N*M (cascata) | 3 | **99%+** |
| 2 | `database-storage.ts` | `getTicketsByStatus/Customer/Official` | 🔴 ALTO | N+1 (JOINs pesados) | 1 | **98%** |
| 3 | `database-storage.ts` | `getRecentTickets()` | 🔴 ALTO | N+1 | 1 | **91%** |
| 4 | `database-storage.ts` | `getTicketReplies()` | 🔴 ALTO | N+1 (efeito cascata) | 1 | **95%** |
| 5 | `database-storage.ts` | `getCategoriesPaginated()` | 🟡 MÉDIO | 2N+1 | 1 | **99%** |
| 6 | `database-storage.ts` | `getTicketsByCategory()` | 🟡 MÉDIO | N+1 | 1 | **95%** |
| 7 | `routes.ts` | Subordinados manager/supervisor | 🟡 MÉDIO | N (x2 locais) | 1 (x2) | **90%** |
| 8 | `routes.ts` | Enriquecimento de clientes | 🔴 ALTO | N (até 50) | 1 | **98%** |
| 9 | `routes/reports.ts` | Métricas por atendente | 🔴 ALTO | 2N (x2 locais) | 1 (x2) | **95%** |
| 10 | `routes/reports.ts` | Métricas por departamento | 🔴 ALTO | 2N (x2 locais) | 1 (x2) | **95%** |
| 11 | `ticket-participants.ts` | Validação de usuários | 🟢 BAIXO | N (N pequeno) | 1 | **80%** |
| 12 | `email-notification-service.ts` | Digest de participantes | 🟡 MÉDIO | N (x2 locais) | 1 | **95%** |
| 13 | `email-notification-service.ts` | SLA breach check | 🔴 ALTO | 2-3N (scheduler) | 3 | **98%** |

---

## Priorização Recomendada

### Fase 1 — Impacto Imediato (Maior ROI)

| Prioridade | Item | Justificativa |
|------------|------|---------------|
| 1 | **#1 + #4** | `getTickets()` + `getTicketReplies()` — O mais crítico, afeta TUDO |
| 2 | **#2 + #3** | `getTicketsByStatus/Customer/Official` + `getRecentTickets()` — Alto uso |
| 3 | **#8** | Enriquecimento de clientes — Endpoint de listagem muito acessado |

**Esforço estimado:** 2-3 dias  
**Impacto esperado:** Redução de 70-80% no tempo de resposta das APIs principais

### Fase 2 — Relatórios e Background

| Prioridade | Item | Justificativa |
|------------|------|---------------|
| 4 | **#9 + #10** | Métricas de relatórios — Performance ruim em relatórios grandes |
| 5 | **#13** | SLA breach — Roda no scheduler, impacto crescente com mais tickets |
| 6 | **#12** | Digest — Scheduler, impacto médio |

**Esforço estimado:** 2-3 dias  
**Impacto esperado:** Relatórios 3-5x mais rápidos, background jobs 10x mais eficientes

### Fase 3 — Refinamento

| Prioridade | Item | Justificativa |
|------------|------|---------------|
| 7 | **#5 + #6** | Categorias e tickets por categoria |
| 8 | **#7** | Departamentos de subordinados |
| 9 | **#11** | Validação de participantes |

**Esforço estimado:** 1 dia  
**Impacto esperado:** Melhorias pontuais, boa prática de código

---

## Estimativa de Impacto Global

### Cenário: Sistema com 500 tickets, 30 atendentes, 10 departamentos

| Métrica | Antes | Depois (estimado) | Melhoria |
|---------|-------|--------------------|----------|
| Queries no `GET /tickets` | ~2.500+ | ~5 | **99.8%** |
| Queries no `GET /tickets?status=X` | ~150 | ~1 | **99.3%** |
| Queries no relatório geral | ~100 | ~3 | **97%** |
| Queries no SLA check (scheduler) | ~1.500 | ~3 | **99.8%** |
| Tempo resposta API principal | ~2-5s | ~100-300ms | **80-95%** |
| Carga no PostgreSQL | Alta | Baixa | **~90%** |

### Benefícios Adicionais

- **Escalabilidade:** O sistema passa a escalar linearmente com o número de tickets, em vez de exponencialmente
- **Conexões ao DB:** Menos queries = menos pressão no pool de conexões
- **Experiência do Usuário:** Páginas carregam significativamente mais rápido
- **Custos de Infraestrutura:** Menor consumo de CPU/memória no servidor de banco de dados

---

## Nota Técnica

O método `getTicketInternal()` (linhas 970-1098 do `database-storage.ts`) já implementa a abordagem correta com **5 LEFT JOINs** em uma única query. Porém, os métodos que listam múltiplos tickets não reutilizam essa lógica de forma eficiente — eles buscam os IDs primeiro e depois chamam `getTicketInternal` N vezes.

**Recomendação arquitetural:** Extrair a lógica de JOINs do `getTicketInternal` em um query builder reutilizável (ex: `ticketBaseQuery()`) que possa ser composto com diferentes `WHERE` clauses, paginação e ordenação. Isso eliminaria a duplicação e garantiria que todos os endpoints usem queries otimizadas.

```typescript
// Exemplo de query builder reutilizável
private ticketBaseQuery() {
  return db.select({
    // ...todos os campos com alias
  })
  .from(tickets)
  .leftJoin(customers, eq(customers.id, tickets.customer_id))
  .leftJoin(officials, eq(officials.id, tickets.assigned_to_id))
  .leftJoin(departments, eq(departments.id, tickets.department_id))
  .leftJoin(incidentTypes, eq(incidentTypes.id, tickets.incident_type_id))
  .leftJoin(categories, eq(categories.id, tickets.category_id));
}

// Uso:
async getTicketsByStatus(status: string) {
  return this.ticketBaseQuery().where(eq(tickets.status, status));
}

async getRecentTickets(limit: number) {
  return this.ticketBaseQuery().orderBy(desc(tickets.created_at)).limit(limit);
}
```
