# Configuração do Scheduler de E-mails

## Problema Resolvido
Quando você tem múltiplos ambientes rodando o scheduler, todos processam tickets de todas as empresas, causando duplicação de e-mails.

## Solução
Use a variável de ambiente `SCHEDULER_COMPANY_FILTER` para controlar quais empresas cada ambiente processa.

## Configurações Disponíveis

### 1. Processar Todas as Empresas
```bash
SCHEDULER_COMPANY_FILTER=*
# ou simplesmente não definir a variável
```

### 2. Processar Apenas Uma Empresa Específica
```bash
SCHEDULER_COMPANY_FILTER=3
```

### 3. Processar Todas as Empresas EXCETO Uma
```bash
SCHEDULER_COMPANY_FILTER=<>3
```

### 4. Processar Múltiplas Empresas Específicas
```bash
SCHEDULER_COMPANY_FILTER=1,2,5
```

## Exemplo de Configuração para Dois Ambientes

### Ambiente 1 (Principal)
```bash
# Processa todas as empresas exceto a ID 3
SCHEDULER_COMPANY_FILTER=<>3
```

### Ambiente 2 (Específico)
```bash
# Processa apenas a empresa ID 3
SCHEDULER_COMPANY_FILTER=3
```

## Logs Informativos

O sistema agora mostra logs claros sobre o que está sendo processado:

```
[Scheduler] Filtro de empresa configurado: <>3
[Email] Filtro aplicado: <>3
[Email] Processando 45 tickets de 3 empresas: [1, 2, 4]
[Scheduler] Verificação de tickets concluída
[Email] Verificação concluída. Analisados 45 tickets em andamento (de 67 total).
```

## Como Implementar

1. **Adicione a variável no seu arquivo `.env`:**
```bash
SCHEDULER_COMPANY_FILTER=<>3
```

2. **Reinicie o servidor** para aplicar a configuração

3. **Verifique os logs** para confirmar que o filtro está funcionando

## Vantagens

- ✅ **Sem duplicação** de e-mails entre ambientes
- ✅ **Flexível** - qualquer combinação de empresas
- ✅ **Fácil de configurar** - uma linha no .env
- ✅ **Logs claros** - sempre mostra o que está sendo processado
- ✅ **Escalável** - funciona com quantas empresas você quiser 