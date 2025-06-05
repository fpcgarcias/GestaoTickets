# Guia de Solução de Problemas - Sistema de Gestão de Tickets

## Problemas de WebSocket e Configuração

### 1. Erro: WebSocket connection failed

**Sintomas:**
- `WebSocket connection to 'wss://app.ticketwise.com.br/?token=...' failed`
- `WebSocket connection to 'wss://localhost:5173/?token=...' failed`

**Causa:**
Configuração mista entre ambiente de desenvolvimento e produção.

**Solução:**

#### Para Desenvolvimento Local:
1. Certifique-se de que o servidor está rodando na porta 5000:
   ```bash
   npm run dev
   ```

2. Acesse a aplicação via `http://localhost:5173` (não via domínio de produção)

3. Verifique se as configurações estão corretas no console do navegador:
   ```
   🔧 [CONFIG] Configuração da aplicação: {
     ambiente: 'DEVELOPMENT',
     apiBaseUrl: 'http://localhost:5000',
     wsBaseUrl: 'ws://localhost:5000'
   }
   ```

#### Para Produção:
1. Certifique-se de que `NODE_ENV=production` está definido
2. O WebSocket deve usar o mesmo domínio da aplicação
3. Use HTTPS em produção (WSS para WebSocket)

### 2. Erro: 401 Unauthorized

**Sintomas:**
- `GET https://app.ticketwise.com.br/api/auth/me 401 (Unauthorized)`

**Causa:**
A aplicação está fazendo requests para o servidor de produção sem autenticação válida.

**Solução:**
1. Faça login novamente na aplicação
2. Verifique se os cookies de sessão estão sendo enviados
3. Em desenvolvimento, certifique-se de acessar via `localhost:5173`

### 3. Erro: Vite HMR Configuration Issue

**Sintomas:**
- `[vite] failed to connect to websocket`
- `Check out your Vite / network configuration`

**Causa:**
O navegador está acessando via domínio de produção, mas o Vite está rodando localmente.

**Solução:**
1. **Para desenvolvimento local:** Acesse sempre via `http://localhost:5173`
2. **Para desenvolvimento em servidor remoto:** Configure as variáveis de ambiente:
   ```bash
   export VITE_HMR_HOST=0.0.0.0
   export VITE_HMR_PORT=24678
   ```

## Configuração Correta por Ambiente

### Desenvolvimento Local
```bash
# Iniciar o servidor
npm run dev

# Acessar via
http://localhost:5173
```

### Desenvolvimento Remoto (Replit, etc.)
```bash
# Configurar variáveis de ambiente
export NODE_ENV=development
export PORT=5000

# Iniciar o servidor
npm run dev
```

### Produção
```bash
# Configurar variáveis de ambiente
export NODE_ENV=production
export PORT=80

# Build e iniciar
npm run build
npm run start:prod
```

## Verificação de Configuração

### 1. Verificar Logs do Console
Abra o console do navegador (F12) e procure por:
- `🔧 [CONFIG] Configuração da aplicação`
- `🔌 [WEBSOCKET] Iniciando conexão`
- `🌐 [API] GET/POST requests`

### 2. Verificar Conectividade
1. **API:** Teste `http://localhost:5000/api/auth/me` (dev) ou `https://seu-dominio.com/api/auth/me` (prod)
2. **WebSocket:** Verifique se a porta 5000 está acessível

### 3. Verificar Autenticação
1. Faça login na aplicação
2. Verifique se o cookie de sessão está sendo enviado
3. Teste endpoints protegidos

## Comandos Úteis para Debug

```bash
# Verificar se o servidor está rodando
netstat -tulpn | grep :5000

# Verificar logs do servidor
tail -f logs/combined.log

# Testar conectividade da API
curl -i http://localhost:5000/api/auth/me

# Verificar variáveis de ambiente
env | grep NODE_ENV
```

## Configurações Recomendadas

### Para Desenvolvimento
- Use sempre `localhost:5173` para acessar a aplicação
- Mantenha `NODE_ENV=development`
- Certifique-se de que o servidor está na porta 5000

### Para Produção
- Configure `NODE_ENV=production`
- Use HTTPS/WSS
- Configure CORS adequadamente
- Use proxy reverso se necessário

## Contato para Suporte

Se os problemas persistirem, verifique:
1. Logs do servidor em `logs/`
2. Console do navegador para erros JavaScript
3. Configurações de rede/firewall
4. Versões das dependências no `package.json` 