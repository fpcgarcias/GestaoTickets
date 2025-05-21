# Migrações e Tabelas Dedicadas

## Novas Tabelas
O sistema agora utiliza tabelas dedicadas para gerenciar departamentos e tipos de chamados, em vez de armazená-los em arrays na tabela de configurações. As seguintes mudanças foram implementadas:

### 1. Tabela `departments`
Uma tabela dedicada para departamentos com os seguintes campos:
- `id`: Identificador único (PRIMARY KEY)
- `name`: Nome do departamento
- `description`: Descrição do departamento
- `company_id`: Referência à empresa
- `is_active`: Indica se o departamento está ativo
- `created_at`: Data de criação
- `updated_at`: Data de atualização

### 2. Adição de coluna `is_active` na tabela `incident_types`
Foi adicionada a coluna `is_active` à tabela `incident_types` para permitir a ativação/desativação de tipos de chamado.

## Sistema de Migrações Automáticas
O sistema agora conta com um mecanismo de migrações automáticas que é executado ao iniciar o servidor. As migrações estão localizadas em `server/migrations` e são executadas na ordem definida em `server/migrate.ts`.

Para executar as migrações manualmente, use o comando:
```
npm run migrate
```

As migrações implementadas são:
- `20240526-create-departments-table.ts`: Cria a tabela `departments` e migra dados existentes da tabela `settings`
- `20240526-add-is-active-to-incident-types.ts`: Adiciona a coluna `is_active` à tabela `incident_types`

## APIs Implementadas
Foram criadas novas APIs para gerenciar departamentos e tipos de chamado:

### Departamentos
- `GET /api/departments`: Lista todos os departamentos
- `POST /api/departments`: Cria um novo departamento
- `GET /api/departments/[id]`: Obtém um departamento específico
- `PUT /api/departments/[id]`: Atualiza um departamento
- `DELETE /api/departments/[id]`: Exclui um departamento

### Tipos de Chamado
- `GET /api/incident-types`: Lista todos os tipos de chamado
- `POST /api/incident-types`: Cria um novo tipo de chamado
- `GET /api/incident-types/[id]`: Obtém um tipo de chamado específico
- `PUT /api/incident-types/[id]`: Atualiza um tipo de chamado
- `DELETE /api/incident-types/[id]`: Exclui um tipo de chamado

## Interface de Usuário
Foram implementadas páginas para gerenciar departamentos e tipos de chamado:
- `/departments`: Gerenciamento de departamentos
- `/ticket-types`: Gerenciamento de tipos de chamado 