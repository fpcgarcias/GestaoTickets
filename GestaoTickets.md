# Sistema de Gestão de Chamados - Oficina Muda

## Visão Geral

O Sistema de Gestão de Chamados é uma aplicação web desenvolvida para gerenciar tickets de suporte técnico e atendimento ao cliente. A plataforma permite o registro, acompanhamento e resolução de chamados, com recursos de gestão de SLA (Service Level Agreement), atribuição de responsáveis, histórico de status e comunicação entre usuários e equipe de suporte.

## Tecnologias Utilizadas

### Frontend
- **React**: Biblioteca JavaScript para construção da interface de usuário
- **TailwindCSS**: Framework CSS para design responsivo
- **Wouter**: Biblioteca de roteamento leve para React
- **React Query**: Gerenciamento de estado e cache de dados
- **React Hook Form**: Gerenciamento de formulários
- **Radix UI**: Componentes acessíveis e personalizáveis
- **Zod**: Validação de esquemas e tipos

### Backend
- **Node.js**: Ambiente de execução JavaScript no servidor
- **Express**: Framework web para Node.js
- **PostgreSQL**: Banco de dados relacional
- **Drizzle ORM**: ORM para interação com o banco de dados
- **Active Directory**: Integração para autenticação de usuários
- **WebSockets**: Comunicação em tempo real

## Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas principais:

1. **users**: Armazena os usuários do sistema, incluindo informações de autenticação e perfil
2. **customers**: Armazena informações dos clientes que abrem tickets
3. **officials**: Equipe de suporte responsável por atender os tickets
4. **tickets**: Registros dos chamados abertos pelos clientes
5. **ticketReplies**: Respostas e interações relacionadas aos tickets
6. **ticketStatusHistory**: Histórico de alterações de status dos tickets
7. **slaDefinitions**: Definições de SLA por prioridade
8. **systemSettings**: Configurações do sistema
9. **incidentTypes**: Tipos de incidentes que podem ser reportados
10. **officialDepartments**: Relação entre atendentes e departamentos

## Principais Funcionalidades

### Autenticação e Autorização

- Login de usuários com suporte a Active Directory (AD)
- Diferentes níveis de acesso: admin, support e customer
- Verificação de autenticação para rotas protegidas

### Gestão de Tickets

- Abertura de novos tickets com título, descrição, prioridade e tipo
- Atribuição de tickets a atendentes específicos
- Acompanhamento do status dos tickets (novo, em andamento, resolvido)
- Sistema de respostas e comunicação entre cliente e atendente
- Possibilidade de respostas internas visíveis apenas para a equipe
- Histórico completo de alterações de status

### SLA e Prioridades

- Definição de tempo de resposta e resolução baseado na prioridade
- Monitoramento de SLA com alertas de violação
- Classificação por prioridade: baixa, média, alta e crítica
- Registro de tempo da primeira resposta e resolução

### Departamentos e Especialidades

- Organização de atendentes por departamentos
- Categorização de tickets por tipo de incidente
- Encaminhamento automático baseado no tipo de incidente

### Dashboard e Relatórios

- Visão geral dos tickets abertos, em andamento e resolvidos
- Estatísticas de tempo médio de resolução
- Distribuição de tickets por departamento e tipo
- Indicadores de desempenho por atendente

### Notificações

- Sistema de notificações para novos tickets e respostas
- Alertas para SLAs próximos do vencimento
- Notificações em tempo real usando WebSockets

### Configurações do Sistema

- Personalização de parâmetros do sistema
- Configuração de integrações externas
- Gerenciamento de usuários e permissões

## Integrações

- **Active Directory**: Autenticação integrada com o sistema de diretório da empresa
- **Email**: Envio de notificações por email
- **API**: Endpoints RESTful para integração com outros sistemas

## Fluxo de Trabalho

1. **Abertura de Ticket**:
   - Cliente acessa o sistema e preenche o formulário de novo ticket
   - O sistema gera um ID único para o ticket e o classifica como "novo"
   - Notificações são enviadas para a equipe de suporte

2. **Triagem**:
   - Atendentes verificam novos tickets
   - O ticket é atribuído a um atendente específico
   - Status muda para "em andamento"

3. **Atendimento**:
   - Atendente analisa e responde ao cliente
   - Comunicação via interface de respostas
   - Possibilidade de comunicação interna entre atendentes

4. **Resolução**:
   - Após solucionar o problema, o ticket é marcado como "resolvido"
   - Sistema registra o tempo total de resolução
   - Cliente pode avaliar o atendimento

## Benefícios

- **Centralização**: Todos os chamados em um único sistema
- **Rastreabilidade**: Histórico completo de todas as interações
- **Padronização**: Processo padronizado de atendimento
- **Eficiência**: Distribuição adequada de recursos
- **Análise**: Dados para tomada de decisão e melhoria contínua
- **Controle de SLA**: Monitoramento dos acordos de nível de serviço

## Requisitos de Sistema

- **Frontend**: Navegador web moderno
- **Backend**: Node.js v14+
- **Banco de Dados**: PostgreSQL 12+
- **Servidor**: 2GB RAM, 1vCPU (mínimo)
- **Armazenamento**: 20GB (recomendado)

## Segurança

- Autenticação segura com senhas criptografadas
- Proteção contra injeção SQL
- Validação de entradas do usuário
- Controle de acesso baseado em função (RBAC)
- Sessões gerenciadas com expiração automática 