# Configuração New Relic + OpenTelemetry

## 📋 Variáveis de Ambiente Necessárias

Adicione estas variáveis no seu arquivo `.env` de **produção**:

```bash
# === NEW RELIC MONITORING ===
# Chave de licença do New Relic (obrigatório)
NEW_RELIC_LICENSE_KEY=your_license_key_here

# Nome da aplicação no New Relic (único por servidor)
NEW_RELIC_APP_NAME=GestaoTickets-Prod-Server1

# Ambiente (production, development, staging)  
NEW_RELIC_ENVIRONMENT=production

# Nível de log do New Relic (error, warn, info, debug)
NEW_RELIC_LOG_LEVEL=info
```

## 🖥️ Configuração Multi-Servidor

Para cada servidor de produção, use um nome único:

**Servidor 1:**
```bash
NEW_RELIC_APP_NAME=GestaoTickets-Prod-Server1
```

**Servidor 2:**
```bash
NEW_RELIC_APP_NAME=GestaoTickets-Prod-Server2
```

**Servidor 3:**
```bash
NEW_RELIC_APP_NAME=GestaoTickets-Prod-Server3
```

## 🚀 Como Obter a Chave do New Relic

1. Acesse sua conta New Relic
2. Vá em **Account Settings** → **API Keys**
3. Copie a **License Key**
4. Cole na variável `NEW_RELIC_LICENSE_KEY`

## 📊 O que Será Monitorado

### ⚡ Automático (OpenTelemetry):
- ✅ Todas as rotas Express
- ✅ Todas as queries PostgreSQL  
- ✅ Requests HTTP externos
- ✅ Operações de arquivo
- ✅ Performance geral da aplicação

### 📈 Métricas Customizadas:
- ✅ Tickets criados por departamento
- ✅ Erros de API por endpoint
- ✅ Logins por tipo de usuário
- ✅ Uploads de arquivos
- ✅ Usuários ativos
- ✅ Conexões WebSocket
- ✅ Conexões do banco

## 🎯 Dashboards no New Relic

Após configurar, você verá:

1. **APM Overview** - Performance geral
2. **Database** - Queries PostgreSQL
3. **External Services** - APIs externas
4. **Errors** - Todos os erros
5. **Infrastructure** - CPU/RAM/Disco
6. **Custom Metrics** - Métricas do negócio

## ⚠️ Importante

- Só monitora quando `NODE_ENV=production`
- Ambientes de desenvolvimento são ignorados
- Logs do New Relic ficam em `logs/newrelic_agent.log`
- Reinicie o servidor após configurar as variáveis
