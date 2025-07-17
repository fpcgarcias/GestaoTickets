# 🚨 CORREÇÃO PARA PRODUÇÃO COM CLOUDFLARE TUNNEL

## CONTEXTO
- Servidor roda **HTTP local** (localhost:5173)
- **Cloudflare Tunnel** expõe como HTTPS (suporte.vixbrasil.com)
- Cliente precisa usar URLs HTTPS quando acessado pelo domínio público

## PROBLEMA IDENTIFICADO
O servidor está rodando com **Vite em modo desenvolvimento**, causando:
1. `import.meta.env.DEV = true` em produção
2. Mixed Content (HTTPS página tentando acessar HTTP API)
3. WebSocket tentando conectar em localhost

## SOLUÇÃO DEFINITIVA

### OPÇÃO 1: Usar servidor compilado (RECOMENDADO)
```bash
# 1. Fazer build
npm run build

# 2. Iniciar servidor compilado
NODE_ENV=production npm run start:prod

# 3. Com PM2
pm2 start ecosystem.config.js
pm2 save
```

### OPÇÃO 2: Continuar com Vite mas em modo produção
```bash
# Usar o novo comando que força produção
NODE_ENV=production npm run start:prod:vite

# OU com PM2
pm2 start "npm run start:prod:vite" --name ticketwise
pm2 save
```

### CONFIGURAÇÃO NGINX (se aplicável)
Se estiver usando Nginx como proxy reverso junto com Cloudflare:
```nginx
location / {
    proxy_pass http://localhost:5173;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## VERIFICAÇÃO
Após reiniciar, no console do navegador deve aparecer:
- ✅ Config: `isDevelopment: false, isProduction: true`
- ✅ `apiBaseUrl: 'https://suporte.vixbrasil.com'`
- ✅ `wsBaseUrl: 'wss://suporte.vixbrasil.com'`
- ✅ Sem erros de Mixed Content
- ✅ Tema carregando corretamente

## RESUMO
O servidor **DEVE** rodar com `NODE_ENV=production` para que o cliente detecte corretamente o ambiente e use HTTPS nas requisições. 