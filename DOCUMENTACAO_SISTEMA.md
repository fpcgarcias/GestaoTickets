# 📋 Documentação Completa do Sistema TicketWise

## 📖 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Funcionalidades Principais](#funcionalidades-principais)
4. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
5. [API e Endpoints](#api-e-endpoints)
6. [Interface do Usuário](#interface-do-usuário)
7. [Sistema de Autenticação](#sistema-de-autenticação)
8. [Sistema de Notificações](#sistema-de-notificações)
9. [Sistema de SLA](#sistema-de-sla)
10. [Inteligência Artificial](#inteligência-artificial)
11. [Configurações e Personalização](#configurações-e-personalização)
12. [Segurança](#segurança)
13. [Deploy e Infraestrutura](#deploy-e-infraestrutura)
14. [Manutenção e Monitoramento](#manutenção-e-monitoramento)
15. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O **TicketWise** é um sistema completo de gestão de tickets (helpdesk) desenvolvido para empresas que precisam gerenciar suporte técnico e atendimento ao cliente de forma eficiente e organizada.

### Características Principais
- **Multi-tenant**: Suporte a múltiplas empresas
- **Multi-idioma**: Interface em português brasileiro
- **Responsivo**: Funciona em desktop, tablet e mobile
- **Tempo real**: Notificações e atualizações em tempo real via WebSocket
- **IA Integrada**: Suporte a análise automática de tickets
- **SLA Flexível**: Sistema de Service Level Agreement configurável
- **Notificações Avançadas**: Email, push e digest personalizados

### Tecnologias Utilizadas
- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Express, TypeScript
- **Banco de Dados**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Autenticação**: Passport.js, bcrypt
- **WebSocket**: ws
- **Email**: Nodemailer
- **IA**: OpenAI, Google AI, Anthropic
- **Storage**: AWS S3
- **Build**: Vite, esbuild

---

## 🏗️ Arquitetura do Sistema

### Estrutura de Pastas
```
GestaoTickets/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── hooks/         # Custom hooks
│   │   ├── contexts/      # Contextos React
│   │   ├── lib/           # Utilitários e configurações
│   │   └── utils/         # Funções utilitárias
├── server/                # Backend Node.js
│   ├── api/              # Endpoints da API
│   ├── services/         # Lógica de negócio
│   ├── middleware/       # Middlewares
│   ├── routes/           # Rotas organizadas
│   └── utils/            # Utilitários do servidor
├── shared/               # Código compartilhado
│   ├── schema.ts         # Schema do banco de dados
│   └── utils/            # Utilitários compartilhados
└── db/                   # Migrações e scripts SQL
```

### Fluxo de Dados
```
Cliente (Browser) ↔ WebSocket ↔ Servidor ↔ Banco de Dados
                ↕
            API REST
                ↕
            Serviços (Email, IA, SLA)
```

---

## ⚙️ Funcionalidades Principais

### 1. Gestão de Tickets
- **Criação**: Formulário completo com anexos
- **Atribuição**: Atendentes e departamentos
- **Status**: 9 status diferentes (novo, em andamento, resolvido, etc.)
- **Prioridades**: Sistema dinâmico por departamento
- **Participantes**: Múltiplos usuários por ticket
- **Histórico**: Rastreamento completo de mudanças
- **Anexos**: Upload de arquivos com preview

### 2. Gestão de Usuários
- **Perfis**: 10 tipos de usuário (admin, support, customer, etc.)
- **Empresas**: Sistema multi-tenant
- **Departamentos**: Organização hierárquica
- **Permissões**: Controle granular de acesso
- **Active Directory**: Integração opcional

### 3. Dashboard e Relatórios
- **Dashboard Principal**: Visão geral dos tickets
- **Dashboard de SLA**: Performance e métricas
- **Dashboard de Performance**: Estatísticas detalhadas
- **Relatórios**: Exportação de dados
- **Gráficos**: Visualizações interativas

### 4. Sistema de Notificações
- **Email**: Templates personalizáveis
- **Tempo real**: WebSocket para atualizações
- **Configurações**: Preferências por usuário
- **Digest**: Resumos diários e semanais
- **Horários**: Controle de quando receber notificações

### 5. Inteligência Artificial
- **Análise Automática**: Classificação de tickets
- **Sugestões**: Respostas e soluções
- **Priorização**: Sugestão automática de prioridade
- **Múltiplos Provedores**: OpenAI, Google, Anthropic
- **Configurações**: Por empresa e departamento

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### Companies (Empresas)
```sql
- id: Serial (PK)
- name: Text (Nome da empresa)
- email: Text (Email de contato)
- domain: Text (Domínio da empresa)
- active: Boolean (Ativa/Inativa)
- ai_permission: Boolean (Permissão para IA)
- uses_flexible_sla: Boolean (SLA flexível)
```

#### Users (Usuários)
```sql
- id: Serial (PK)
- username: Text (Nome de usuário)
- email: Text (Email único)
- password: Text (Senha criptografada)
- role: Enum (Tipo de usuário)
- company_id: Integer (FK para empresa)
- active: Boolean (Ativo/Inativo)
- must_change_password: Boolean (Forçar troca de senha)
```

#### Tickets (Chamados)
```sql
- id: Serial (PK)
- title: Text (Título)
- description: Text (Descrição)
- status: Enum (Status atual)
- priority: Text (Prioridade dinâmica)
- customer_id: Integer (FK para cliente)
- official_id: Integer (FK para atendente)
- department_id: Integer (FK para departamento)
- company_id: Integer (FK para empresa)
- created_at: Timestamp
- updated_at: Timestamp
```

#### TicketReplies (Respostas)
```sql
- id: Serial (PK)
- ticket_id: Integer (FK para ticket)
- user_id: Integer (FK para usuário)
- content: Text (Conteúdo da resposta)
- is_internal: Boolean (Nota interna)
- created_at: Timestamp
```

#### TicketParticipants (Participantes)
```sql
- id: Serial (PK)
- ticket_id: Integer (FK para ticket)
- user_id: Integer (FK para usuário)
- added_by: Integer (FK para usuário que adicionou)
- added_at: Timestamp
```

### Relacionamentos
- **Empresa** → **Usuários** (1:N)
- **Empresa** → **Departamentos** (1:N)
- **Empresa** → **Tickets** (1:N)
- **Ticket** → **Respostas** (1:N)
- **Ticket** → **Participantes** (1:N)
- **Ticket** → **Anexos** (1:N)

---

## 🔌 API e Endpoints

### Autenticação
```
POST /api/auth/login          # Login
POST /api/auth/logout         # Logout
GET  /api/auth/me             # Usuário atual
POST /api/auth/change-password # Trocar senha
```

### Tickets
```
GET    /api/tickets           # Listar tickets
POST   /api/tickets           # Criar ticket
GET    /api/tickets/:id       # Detalhes do ticket
PUT    /api/tickets/:id       # Atualizar ticket
DELETE /api/tickets/:id       # Excluir ticket
POST   /api/tickets/:id/replies # Adicionar resposta
GET    /api/tickets/:id/history # Histórico do ticket
```

### Usuários
```
GET    /api/users             # Listar usuários
POST   /api/users             # Criar usuário
GET    /api/users/:id         # Detalhes do usuário
PUT    /api/users/:id         # Atualizar usuário
DELETE /api/users/:id         # Excluir usuário
```

### Departamentos
```
GET    /api/departments       # Listar departamentos
POST   /api/departments       # Criar departamento
GET    /api/departments/:id   # Detalhes do departamento
PUT    /api/departments/:id   # Atualizar departamento
DELETE /api/departments/:id   # Excluir departamento
```

### SLA
```
GET    /api/sla-configurations    # Configurações de SLA
POST   /api/sla-configurations    # Criar configuração
GET    /api/sla-dashboard         # Dashboard de SLA
GET    /api/sla-resolver          # Resolver SLA
```

### IA
```
POST   /api/ai-configurations     # Configurar IA
GET    /api/ai-configurations     # Listar configurações
POST   /api/ai/analyze            # Analisar ticket
```

### Notificações
```
GET    /api/notifications         # Listar notificações
POST   /api/notifications/mark-read # Marcar como lida
GET    /api/notifications/settings # Configurações
PUT    /api/notifications/settings # Atualizar configurações
```

---

## 🎨 Interface do Usuário

### Componentes Principais

#### Layout
- **Sidebar**: Navegação principal
- **Header**: Informações do usuário e notificações
- **Main Content**: Área de conteúdo dinâmica
- **Responsive**: Adaptação para mobile

#### Componentes de Ticket
- **TicketCard**: Card resumido do ticket
- **TicketDetail**: Visualização completa
- **TicketForm**: Formulário de criação/edição
- **TicketReply**: Sistema de respostas
- **StatusBadge**: Indicador visual de status
- **SLAAIndicator**: Indicador de SLA

#### Componentes de UI
- **Button**: Botões padronizados
- **Modal**: Diálogos modais
- **Table**: Tabelas responsivas
- **Form**: Formulários com validação
- **Chart**: Gráficos interativos
- **Toast**: Notificações temporárias

### Páginas Principais

#### Dashboard
- Visão geral dos tickets
- Estatísticas em tempo real
- Gráficos de performance
- Tickets recentes

#### Gestão de Tickets
- Lista de tickets com filtros
- Criação de novos tickets
- Detalhes e histórico
- Sistema de respostas

#### Gestão de Usuários
- Lista de usuários
- Criação e edição
- Configurações de permissões
- Integração com AD

#### Configurações
- Configurações do sistema
- Configurações de email
- Configurações de IA
- Configurações de SLA

---

## 🔐 Sistema de Autenticação

### Tipos de Usuário
1. **admin**: Acesso total ao sistema (multi-empresa)
2. **company_admin**: Admin local da empresa
3. **manager**: Gestor da equipe
4. **supervisor**: Nível entre manager e support
5. **support**: Atendente
6. **triage**: Classificação e encaminhamento
7. **quality**: Avaliação de qualidade
8. **customer**: Cliente da empresa
9. **viewer**: Apenas visualização
10. **integration_bot**: Bots e integrações

### Permissões por Tipo
- **admin**: Todas as permissões
- **company_admin**: Todas as permissões da empresa
- **manager**: Gestão de equipe e tickets
- **support**: Atendimento e gestão de tickets
- **customer**: Apenas seus próprios tickets
- **viewer**: Apenas visualização

### Segurança
- **Senhas**: Criptografadas com bcrypt
- **Sessões**: Gerenciadas com express-session
- **Rate Limiting**: Proteção contra ataques
- **CORS**: Configuração de origens permitidas
- **Helmet**: Headers de segurança

---

## 📧 Sistema de Notificações

### Tipos de Notificação
1. **Email**: Notificações por email
2. **WebSocket**: Notificações em tempo real
3. **Digest**: Resumos diários/semanais
4. **Push**: Notificações do navegador

### Configurações por Usuário
- **Email habilitado**: Receber notificações por email
- **Horários**: Horário de início e fim
- **Fim de semana**: Receber aos fins de semana
- **Tipos específicos**: Configurar por tipo de notificação

### Templates de Email
- **Nova resposta**: Notificação de nova resposta
- **Mudança de status**: Alteração de status do ticket
- **Participante adicionado**: Novo participante no ticket
- **Digest diário**: Resumo das atividades do dia
- **Digest semanal**: Resumo das atividades da semana

### Fluxo de Notificações
```
Evento → Verificar configurações → Enviar notificação → Log
```

---

## ⏱️ Sistema de SLA

### Configurações de SLA
- **Por empresa**: Configurações específicas por empresa
- **Por departamento**: SLA diferente por departamento
- **Por tipo de incidente**: SLA por categoria
- **Por prioridade**: SLA por nível de prioridade

### Métricas de SLA
- **Tempo de resposta**: Tempo para primeira resposta
- **Tempo de resolução**: Tempo para resolver o ticket
- **Conformidade**: Percentual de tickets dentro do SLA
- **Violações**: Tickets que ultrapassaram o SLA

### Dashboard de SLA
- **Visão geral**: Métricas principais
- **Gráficos**: Visualização de performance
- **Alertas**: Notificações de violações
- **Relatórios**: Exportação de dados

### Cálculo de SLA
```typescript
// Exemplo de cálculo
const slaTime = slaConfig.response_time_hours;
const ticketAge = Date.now() - ticket.created_at;
const isViolated = ticketAge > (slaTime * 60 * 60 * 1000);
```

---

## 🤖 Inteligência Artificial

### Provedores Suportados
1. **OpenAI**: GPT-3.5, GPT-4
2. **Google AI**: Gemini
3. **Anthropic**: Claude

### Funcionalidades de IA
- **Análise de tickets**: Classificação automática
- **Sugestões de resposta**: Respostas sugeridas
- **Priorização**: Sugestão de prioridade
- **Categorização**: Classificação por tipo
- **Resumo**: Resumo automático do ticket

### Configurações de IA
- **Por empresa**: Configurações específicas
- **Por departamento**: IA por área
- **Prompts personalizados**: Prompts customizados
- **Limites de uso**: Controle de custos

### Integração
```typescript
// Exemplo de uso da IA
const analysis = await aiService.analyzeTicket({
  title: ticket.title,
  description: ticket.description,
  company_id: ticket.company_id
});
```

---

## ⚙️ Configurações e Personalização

### Configurações do Sistema
- **Nome da empresa**: Personalização da marca
- **Logo**: Upload de logo personalizada
- **Cores**: Tema personalizado
- **Idioma**: Configuração de idioma
- **Fuso horário**: Configuração de timezone

### Configurações de Email
- **SMTP**: Configurações do servidor
- **Templates**: Templates personalizados
- **Assinatura**: Assinatura padrão
- **Remetente**: Email de envio

### Configurações de IA
- **Provedor**: Escolha do provedor
- **API Key**: Chave de API
- **Modelo**: Modelo específico
- **Prompts**: Prompts customizados

### Configurações de SLA
- **Tempos**: Configuração de prazos
- **Alertas**: Configuração de alertas
- **Relatórios**: Configuração de relatórios

---

## 🔒 Segurança

### Autenticação
- **Senhas**: Criptografia bcrypt
- **Sessões**: Gerenciamento seguro
- **Tokens**: JWT para API
- **2FA**: Autenticação de dois fatores (opcional)

### Autorização
- **RBAC**: Role-Based Access Control
- **Permissões**: Controle granular
- **Auditoria**: Log de ações
- **Isolamento**: Separação por empresa

### Proteção de Dados
- **Criptografia**: Dados sensíveis criptografados
- **Backup**: Backup automático
- **Compliance**: Conformidade com LGPD
- **Auditoria**: Logs de acesso

### Segurança da Aplicação
- **Helmet**: Headers de segurança
- **CORS**: Controle de origens
- **Rate Limiting**: Proteção contra ataques
- **XSS Protection**: Proteção contra XSS
- **SQL Injection**: Proteção via ORM

---

## 🚀 Deploy e Infraestrutura

### Requisitos do Sistema
- **Node.js**: Versão 18 ou superior
- **PostgreSQL**: Versão 12 ou superior
- **Redis**: Para sessões (opcional)
- **Nginx**: Proxy reverso (recomendado)

### Variáveis de Ambiente
```bash
# Banco de dados
DATABASE_URL=postgresql://user:pass@host:port/db

# Autenticação
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# IA
OPENAI_API_KEY=your-openai-key
GOOGLE_AI_API_KEY=your-google-key
ANTHROPIC_API_KEY=your-anthropic-key

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=your-bucket-name

# Sistema
NODE_ENV=production
PORT=3000
```

### Scripts de Deploy
```bash
# Instalação
npm install

# Build
npm run build

# Migrações
npm run migrate:up

# Inicialização
npm run start:prod
```

### Docker (Opcional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

---

## 📊 Manutenção e Monitoramento

### Logs
- **Aplicação**: Logs de erro e info
- **Acesso**: Logs de requisições
- **Performance**: Logs de performance
- **Segurança**: Logs de segurança

### Monitoramento
- **Uptime**: Monitoramento de disponibilidade
- **Performance**: Métricas de performance
- **Erros**: Monitoramento de erros
- **Recursos**: Uso de CPU, memória, disco

### Backup
- **Banco de dados**: Backup automático diário
- **Arquivos**: Backup de anexos
- **Configurações**: Backup de configurações
- **Logs**: Backup de logs

### Manutenção
- **Migrações**: Atualizações do banco
- **Limpeza**: Limpeza de logs antigos
- **Otimização**: Otimização de performance
- **Segurança**: Atualizações de segurança

---

## 🔧 Troubleshooting

### Problemas Comuns

#### Erro de Conexão com Banco
```bash
# Verificar variáveis de ambiente
echo $DATABASE_URL

# Testar conexão
psql $DATABASE_URL -c "SELECT 1"

# Verificar logs
tail -f logs/error.log
```

#### Erro de Autenticação
```bash
# Verificar configurações de sessão
echo $SESSION_SECRET

# Limpar sessões
npm run migrate:down
npm run migrate:up

# Verificar logs de autenticação
grep "AUTH" logs/access.log
```

#### Problemas de Email
```bash
# Testar configurações SMTP
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

#### Problemas de Performance
```bash
# Verificar uso de recursos
htop
df -h
free -h

# Verificar logs de performance
grep "PERFORMANCE" logs/performance.log

# Otimizar banco de dados
npm run db:optimize
```

### Comandos Úteis
```bash
# Status das migrações
npm run migrate:status

# Executar migrações
npm run migrate:up

# Reverter migrações
npm run migrate:down

# Verificar tipos
npm run check

# Build de produção
npm run build:prod

# Limpar cache
npm run clean
```

### Logs Importantes
- **Erro**: `logs/error.log`
- **Acesso**: `logs/access.log`
- **Performance**: `logs/performance.log`
- **Segurança**: `logs/security.log`
- **Email**: `logs/email.log`
- **IA**: `logs/ai.log`

---

## 📞 Suporte

### Contatos
- **Email**: suporte@ticketwise.com.br
- **Telefone**: (27) 99999-9999
- **WhatsApp**: (27) 99999-9999

### Documentação Adicional
- **API Docs**: `/api/docs`
- **Changelog**: `/changelog`
- **FAQ**: `/faq`

### Comunidade
- **GitHub**: https://github.com/ticketwise
- **Discord**: https://discord.gg/ticketwise
- **Blog**: https://blog.ticketwise.com.br

---

## 📄 Licença

Este software é licenciado sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

**Versão da Documentação**: 1.0.0  
**Última Atualização**: Janeiro 2025  
**Sistema**: TicketWise v1.0.0 