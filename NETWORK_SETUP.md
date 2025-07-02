# Configuração de Rede para Desenvolvimento

## 🌐 Acesso Externo ao Ambiente de Desenvolvimento

### Problema
Quando você tenta acessar a aplicação de uma máquina diferente (ex: `http://192.168.4.53:5173`), podem ocorrer os seguintes erros:

1. **CORS/COOP Headers**: Políticas de segurança do navegador
2. **WebSocket Failures**: HMR não funciona
3. **API Connection Refused**: Chamadas API falham
4. **Origin-Agent-Cluster**: Problemas de clustering

### ✅ Soluções Implementadas

#### 1. **Configuração Dinâmica de API** (`client/src/lib/config.ts`)
```typescript
// Agora detecta automaticamente se está sendo acessado de máquina externa
// e ajusta as URLs de API correspondentemente
if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
  // Acesso local - usa localhost
  apiBaseUrl: 'http://localhost:5173'
} else {
  // Acesso externo - usa o IP atual
  apiBaseUrl: `http://${currentHost}`
}
```

#### 2. **Configuração Vite Otimizada** (`vite.config.ts`)
```typescript
server: {
  host: '0.0.0.0',        // Aceita conexões de qualquer IP
  port: 5173,
  cors: {
    origin: true,          // Permite qualquer origem
    credentials: true,     // Suporte a credenciais
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  hmr: {
    host: '0.0.0.0',      // HMR aceita de qualquer IP
    port: 24678           // Porta dedicada para HMR
  }
}
```

### 🚀 Como Usar

#### 1. **Iniciar o Servidor**
```bash
npm run dev
```

#### 2. **Acessar Localmente**
```
http://localhost:5173
```

#### 3. **Acessar de Outra Máquina**
```
http://[IP_DA_MAQUINA_HOST]:5173
# Exemplo: http://192.168.4.53:5173
```

### 🔍 Verificação

#### Debug no Console
A aplicação agora mostra informações de configuração no console:
```
🔧 App Config: {
  apiBaseUrl: "http://192.168.4.53:5173",
  wsBaseUrl: "ws://192.168.4.53:5173",
  currentHost: "192.168.4.53:5173",
  isDevelopment: true
}
```

#### Testes de Conectividade
1. **API Health**: `GET http://[IP]:5173/api/auth/me`
2. **WebSocket**: Deve conectar automaticamente
3. **HMR**: Hot reload deve funcionar

### ⚠️ Limitações Conhecidas

#### 1. **Políticas de Segurança do Navegador**
Alguns navegadores podem ainda mostrar warnings sobre:
- Cross-Origin-Opener-Policy
- Origin-Agent-Cluster

**Solução**: Use `localhost` ou configure HTTPS se necessário.

#### 2. **Firewall/Rede**
Certifique-se de que as portas estão abertas:
- **5173**: Aplicação principal
- **24678**: Hot Module Replacement (HMR)

### 🔧 Troubleshooting

#### Problema: API ainda falha
```bash
# Verificar se o servidor está rodando na interface correta
netstat -an | grep 5173
# Deve mostrar: 0.0.0.0:5173
```

#### Problema: WebSocket não conecta
```bash
# Verificar porta HMR
netstat -an | grep 24678
# Deve mostrar: 0.0.0.0:24678
```

#### Problema: Firewall bloqueando
```bash
# Windows - permitir portas no firewall
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="Vite HMR" dir=in action=allow protocol=TCP localport=24678
```

### 📱 Acesso Mobile

Para testar em dispositivos móveis na mesma rede:
```
http://[IP_DA_MAQUINA]:5173
```

### 🔒 Produção

Em produção, todas essas configurações são ajustadas automaticamente para usar HTTPS e o domínio correto. 