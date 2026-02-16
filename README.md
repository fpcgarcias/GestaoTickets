# TicketWise - Sistema de Gestão de Chamados

Sistema completo de gestão de chamados (tickets) com notificações persistentes, Web Push e interface moderna.

## 🚀 Funcionalidades Principais

- **Gestão de Chamados**: Criação, acompanhamento e resolução de tickets
- **Sistema de Notificações**: Notificações em tempo real via WebSocket e Web Push
- **Histórico Persistente**: Todas as notificações são salvas no banco de dados
- **Filtros Avançados**: Busca e filtragem de notificações por tipo, data, status
- **Suporte Offline**: Notificações push mesmo com aplicação fechada
- **Interface Responsiva**: Funciona em desktop e mobile
- **Multilíngue**: Suporte a português e inglês

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as seguintes variáveis:

```env
# Banco de Dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/ticketwise

# Servidor
PORT=5173
SESSION_SECRET=sua_chave_secreta_aqui
NODE_ENV=development

# Armazenamento de Arquivos (Wasabi/S3)
WASABI_ACCESS_KEY_ID=sua_access_key
WASABI_SECRET_ACCESS_KEY=sua_secret_key
WASABI_BUCKET_NAME=seu_bucket
WASABI_REGION=us-east-1
WASABI_ENDPOINT=https://s3.wasabisys.com

# Web Push (Notificações)
VAPID_PUBLIC_KEY=sua_chave_publica_vapid
VAPID_PRIVATE_KEY=sua_chave_privada_vapid
VAPID_SUBJECT=mailto:seu-email@dominio.com

# Limpeza Automática de Notificações
READ_NOTIFICATIONS_RETENTION_DAYS=90
UNREAD_NOTIFICATIONS_RETENTION_DAYS=180

# E-mail em desenvolvimento (evita disparar para clientes reais com banco cópia de produção)
# EMAIL_DEV_DISABLE=true          → não envia nenhum e-mail em dev (apenas log)
# EMAIL_DEV_OVERRIDE=teste@email.com → em dev, redireciona todos os destinatários para este e-mail
# Se nenhuma for definida em dev, o padrão é não enviar (segurança).
```

### 2. Configuração do Banco de Dados

```bash
# Instalar dependências
npm install

# Executar migrações
npm run migrate

# (Opcional) Popular com dados de exemplo
npm run seed
```

### 3. Configuração de Web Push

As chaves VAPID são necessárias para enviar notificações push. Se você não tiver chaves configuradas:

1. **Gerar chaves VAPID**:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Adicionar ao .env**:
   ```env
   VAPID_PUBLIC_KEY=BAnG9uum3bgKZNm9cPV19KLY0HFW6i3An6PXaW0INaenLhXjaKx4gixzX3rIq_d_K7praKBRRh3Htx1wGYzTwxc
   VAPID_PRIVATE_KEY=oIod-Yuv2JLTzqZeDWpdcEBxt5juLNvRMoh5RpFQu5o
   VAPID_SUBJECT=mailto:contato@seudominio.com
   ```

3. **Importante**: 
   - Mantenha a chave privada segura
   - Use um email válido no VAPID_SUBJECT
   - Não regenere as chaves em produção

## 🏃‍♂️ Executando o Projeto

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

O servidor estará disponível em `http://localhost:5173`

### Produção

```bash
# Build do projeto
npm run build

# Executar em produção
npm start
```

## 📱 Sistema de Notificações

### Configuração no Navegador

1. **Permissões**: O sistema solicitará permissão para notificações na primeira vez
2. **Service Worker**: Será registrado automaticamente para Web Push
3. **Offline**: Notificações funcionam mesmo com a aplicação fechada

### Tipos de Notificação

- `new_ticket` - Novo chamado criado
- `status_change` - Mudança de status do chamado  
- `new_reply` - Nova resposta no chamado
- `participant_added` - Participante adicionado
- `participant_removed` - Participante removido
- `ticket_escalated` - Chamado escalado
- `ticket_due_soon` - Chamado próximo do vencimento

### Gerenciamento

- **Histórico**: Todas as notificações ficam salvas no banco
- **Filtros**: Filtre por tipo, data, status de leitura
- **Busca**: Busque por texto no título ou mensagem
- **Limpeza**: Notificações antigas são removidas automaticamente
  - Lidas: 90 dias (configurável)
  - Não lidas: 180 dias (configurável)

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Servidor de desenvolvimento
npm run build        # Build para produção
npm start           # Executar build de produção

# Banco de Dados
npm run migrate     # Executar migrações
npm run seed        # Popular com dados de exemplo

# Testes
npm test           # Executar todos os testes
npm run test:unit  # Testes unitários
npm run test:e2e   # Testes end-to-end

# Linting e Formatação
npm run lint       # Verificar código
npm run format     # Formatar código
```

## 📚 Documentação da API

### Endpoints de Notificações

Consulte a [documentação completa da API](./docs/NOTIFICATIONS_API.md) para detalhes sobre:

- Listagem de notificações com filtros
- Marcação como lida/não lida
- Exclusão de notificações
- Gerenciamento de push subscriptions
- WebSocket events

### Estrutura de Dados

Veja a [documentação da estrutura de dados](./docs/NOTIFICATIONS_DATA_STRUCTURE.md) para:

- Schema do banco de dados
- Tipos TypeScript
- Formatos de payload
- Exemplos de metadados

## 🏗️ Arquitetura

### Backend
- **Node.js** com Express
- **PostgreSQL** com Drizzle ORM
- **WebSocket** para tempo real
- **Web Push** para notificações offline

### Frontend  
- **React** com TypeScript
- **Vite** para build
- **TailwindCSS** para estilização
- **React Query** para cache de dados

### Notificações
- **Persistência** no PostgreSQL
- **Entrega dual**: WebSocket + Web Push
- **Service Worker** para push notifications
- **Limpeza automática** com cron jobs

## 🔒 Segurança

- Autenticação baseada em sessão
- Autorização por usuário (cada um vê apenas suas notificações)
- Validação de inputs em todas as APIs
- Sanitização de conteúdo no frontend
- Rate limiting nas APIs críticas

## 🚀 Deploy

### Variáveis de Produção

Certifique-se de configurar em produção:

```env
NODE_ENV=production
DATABASE_URL=sua_url_de_producao
SESSION_SECRET=chave_secreta_forte
VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PRIVATE_KEY=sua_chave_privada
VAPID_SUBJECT=mailto:contato@seudominio.com
```

### Considerações

- Configure HTTPS para Web Push funcionar
- Configure domínio no VAPID_SUBJECT
- Monitore logs de erro das notificações
- Configure backup do banco de dados

## 🐛 Troubleshooting

### Notificações não funcionam

1. **Verificar permissões**: Usuário concedeu permissão no navegador?
2. **Verificar HTTPS**: Web Push requer HTTPS em produção
3. **Verificar chaves VAPID**: Estão configuradas corretamente?
4. **Verificar logs**: Há erros no console do servidor?

### Service Worker não registra

1. **Verificar arquivo**: `client/public/sw.js` existe?
2. **Verificar HTTPS**: Service Worker requer HTTPS em produção  
3. **Verificar console**: Há erros no DevTools?

### Banco de dados

1. **Verificar conexão**: DATABASE_URL está correto?
2. **Verificar migrações**: Executou `npm run migrate`?
3. **Verificar tabelas**: Tabelas `notifications` e `push_subscriptions` existem?

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

- **Email**: contato@ticketwise.com.br
- **Documentação**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/seu-usuario/ticketwise/issues)