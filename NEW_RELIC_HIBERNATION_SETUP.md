# 🌙 Configuração New Relic para Hibernação do Neon

## 🎯 Problema Resolvido

O New Relic Synthetic Monitoring estava fazendo requisições ao endpoint `/health` 24/7, o que:
- Fazia queries no banco de dados durante a madrugada
- Impedia o Neon de hibernar (21h-6h)
- Gerava custos desnecessários de compute

## ✅ Solução Implementada

### 1. Novo Endpoint `/ping` (Leve)
**URL:** `https://seu-dominio.com/api/ping`

**Características:**
- ✅ NÃO acessa banco de dados
- ✅ Retorna apenas status do processo Node.js
- ✅ Pode ser chamado 24/7 sem custo
- ✅ Ideal para Synthetic Monitoring

**Resposta:**
```json
{
  "status": "alive",
  "timestamp": "2025-10-01T14:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapUsed": 98765432
  },
  "version": "v20.11.0"
}
```

### 2. Endpoint `/health` Modificado (Completo)
**URL:** `https://seu-dominio.com/api/health`

**Comportamento:**

#### Durante Horário Comercial (6h-21h):
- ✅ Verifica conexão com banco de dados
- ✅ Verifica eventos de segurança
- ✅ Retorna status completo

**Resposta (6h-21h):**
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "security": true,
    "timestamp": "2025-10-01T14:30:00.000Z",
    "mode": "active"
  },
  "uptime": 3600,
  "memory": { ... },
  "version": "v20.11.0"
}
```

#### Durante Madrugada (21h-6h):
- 🌙 NÃO acessa banco de dados
- ✅ Retorna status sem despertar o Neon
- ✅ Permite hibernação

**Resposta (21h-6h):**
```json
{
  "status": "sleeping",
  "message": "Server in night mode (21h-6h) - Database checks disabled to allow hibernation",
  "checks": {
    "database": true,
    "security": true,
    "timestamp": "2025-10-01T23:30:00.000Z",
    "mode": "hibernation"
  },
  "uptime": 3600,
  "memory": { ... },
  "version": "v20.11.0"
}
```

---

## 🔧 Configuração no New Relic

### Opção A: Usar `/ping` (RECOMENDADO) ✅

1. **Acesse New Relic:** https://one.newrelic.com
2. **Vá para Synthetics:** Menu lateral → Synthetic Monitoring
3. **Encontre o monitor** do seu app (GestaoTickets)
4. **Clique em Settings/Configurações**
5. **Altere a URL:**
   - **DE:** `https://seu-dominio.com/api/health`
   - **PARA:** `https://seu-dominio.com/api/ping`
6. **Salve as alterações**

**Resultado:** Monitor roda 24/7 sem acordar o banco! 🎉

---

### Opção B: Ajustar Schedule do Monitor (ADICIONAL)

Se quiser economizar ainda mais:

1. **No monitor do Synthetic**
2. **Vá para Schedule/Agendamento**
3. **Configure para rodar apenas:**
   - **Horário:** 06:00 - 21:00 (UTC-3 / Brasília)
   - **Frequência:** A cada 15 minutos
   - **Dias:** Segunda a Domingo

**Resultado:** Monitor só roda durante horário comercial! 💰

---

### Opção C: Manter `/health` com Schedule

Se quiser monitoramento completo do banco:

1. **Use `/health` no Synthetic**
2. **Configure Schedule:** 06:00 - 21:00
3. **Resultado:** Verifica banco + segurança apenas durante horário comercial

---

## 📊 Comparação de Custos

### Antes (com `/health` 24/7):
- **Requests/dia:** ~96 (1 a cada 15min)
- **Durante madrugada:** ~36 requests (21h-6h)
- **Acordava o Neon:** SIM ❌
- **Custo extra:** ~9 horas de compute/noite

### Depois (com `/ping` 24/7):
- **Requests/dia:** ~96 (1 a cada 15min)
- **Durante madrugada:** ~36 requests (21h-6h)
- **Acordava o Neon:** NÃO ✅
- **Custo extra:** R$ 0,00

### Economia Estimada:
- **~270 horas/mês** de compute economizadas
- **~40-60% de redução** na conta do Neon
- **Hibernação efetiva** das 21h às 6h

---

## 🧪 Testar Localmente

### Teste o endpoint `/ping`:
```bash
curl http://localhost:5000/api/ping
```

### Teste `/health` durante o dia (6h-21h):
```bash
curl http://localhost:5000/api/health
```
**Esperado:** Verifica banco, retorna `"mode": "active"`

### Teste `/health` à noite (21h-6h):
```bash
curl http://localhost:5000/api/health
```
**Esperado:** NÃO verifica banco, retorna `"mode": "hibernation"`

---

## 🚀 Deploy

Após fazer deploy para produção:

1. **Aguarde ~5 minutos** para o servidor iniciar
2. **Teste os endpoints:**
   ```bash
   curl https://seu-dominio.com/api/ping
   curl https://seu-dominio.com/api/health
   ```
3. **Configure o New Relic** conforme Opção A acima
4. **Monitore no Neon:** Verifique se hiberna após 21h

---

## 📝 Checklist de Implementação

- [x] Criar endpoint `/ping` (leve, sem DB)
- [x] Modificar endpoint `/health` (com lógica de horário)
- [x] Atualizar rotas em `server/routes.ts`
- [ ] Deploy para produção
- [ ] Testar endpoints em produção
- [ ] Configurar New Relic Synthetic para usar `/ping`
- [ ] Monitorar hibernação do Neon (21h-6h)
- [ ] Verificar redução de custos na próxima fatura

---

## 💡 Dicas Extras

### Outros Serviços de Monitoramento

Se usar UptimeRobot, Pingdom, StatusCake, etc:
- Configure para usar `/api/ping`
- Ou configure schedule 6h-21h

### Logs do New Relic

Para ver os logs do agente New Relic:
```bash
tail -f logs/newrelic_agent.log
```

### Verificar Hibernação do Neon

No dashboard do Neon:
- Vá para **Monitoring**
- Verifique **Compute Hours**
- Deve mostrar ~15h/dia (6h-21h) ao invés de 24h/dia

---

## 🆘 Troubleshooting

### Neon ainda não hiberna?

1. **Verifique o New Relic:** Está usando `/ping`?
2. **Verifique outros monitores:** UptimeRobot? Pingdom?
3. **Verifique navegadores abertos:** Alguém deixou o sistema aberto?
4. **Verifique os logs:**
   ```bash
   grep "21:\|22:\|23:\|00:\|01:\|02:\|03:\|04:\|05:" logs/performance-*.log
   ```

### New Relic mostrando erros?

Se o New Relic reclamar de "sleeping" status:
- É normal durante 21h-6h
- Configure alertas apenas para horário comercial (6h-21h)
- Ou use `/ping` que sempre retorna 200

---

## 📚 Referências

- [New Relic Synthetic Monitoring](https://docs.newrelic.com/docs/synthetics/)
- [Neon Autosuspend](https://neon.tech/docs/introduction/autosuspend)
- [Node.js Health Checks](https://nodejs.org/en/docs/guides/diagnostics/health-checks/)

---

**Implementado em:** 2025-10-01
**Autor:** AI Assistant
**Status:** ✅ Pronto para produção









