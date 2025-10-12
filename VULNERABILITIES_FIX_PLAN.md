# 🔒 Plano de Correção de Vulnerabilidades

**Data**: 12/10/2025  
**Total**: 10 vulnerabilidades (3 Altas, 5 Moderadas, 2 Baixas)

---

## ⚡ AÇÃO IMEDIATA (Vulnerabilidades Críticas)

### 1. Atualizar `multer` 🔴 URGENTE
```bash
npm install multer@^2.0.2 --legacy-peer-deps
```
**Motivo**: DoS crítico que pode derrubar o servidor  
**Prioridade**: MÁXIMA

### 2. Atualizar `xlsx` 🔴 URGENTE  
```bash
npm install xlsx@^0.20.3 --legacy-peer-deps
```
**Motivo**: Prototype Pollution + ReDoS  
**Prioridade**: MÁXIMA  
**Atenção**: Testar funcionalidades de exportação/importação Excel após a atualização

### 3. Atualizar `nodemailer` 🟠
```bash
npm install nodemailer@^7.0.7 --legacy-peer-deps
```
**Motivo**: Possível vazamento de emails  
**Prioridade**: ALTA  

---

## 🛠️ Correções de Baixo Risco

### 4. Atualizar outras dependências vulneráveis
```bash
# Tentar corrigir automaticamente
npm audit fix --legacy-peer-deps

# Se não funcionar, tentar força (cuidado com breaking changes)
npm audit fix --force --legacy-peer-deps
```

---

## 📋 Comandos Completos

### Opção 1: Atualização Manual (RECOMENDADO)
```bash
# 1. Backup do package.json atual
cp package.json package.json.backup

# 2. Atualizar pacotes críticos
npm install multer@^2.0.2 --legacy-peer-deps
npm install xlsx@^0.20.3 --legacy-peer-deps  
npm install nodemailer@^7.0.7 --legacy-peer-deps

# 3. Tentar corrigir o resto automaticamente
npm audit fix --legacy-peer-deps

# 4. Verificar se ainda há vulnerabilidades
npm audit
```

### Opção 2: Correção Automática (Mais Rápido, Pode Quebrar)
```bash
npm audit fix --force --legacy-peer-deps
```

---

## ✅ Testes Pós-Atualização

Após as atualizações, **TESTAR OBRIGATORIAMENTE**:

1. ✅ Upload de anexos (multer)
2. ✅ Exportação/Importação de relatórios Excel (xlsx)
3. ✅ Envio de emails/notificações (nodemailer)
4. ✅ Sistema de sessões (express-session)
5. ✅ Funcionalidades do banco de dados (drizzle-kit)

### Comandos de teste:
```bash
# Compilar o projeto
npm run build

# Rodar em modo desenvolvimento
npm run dev

# Verificar se não há erros de TypeScript
npm run check
```

---

## 🔍 Detalhes Técnicos das Vulnerabilidades

### CVEs Identificados:

| Pacote | CVE | Severidade | Score CVSS |
|--------|-----|------------|------------|
| multer | GHSA-fjgf-rc76-4x9p | HIGH | 7.5 |
| xlsx | GHSA-4r6h-8v6p-xvw6 | HIGH | 7.8 |
| xlsx | GHSA-5pgg-2g8v-p4x9 | HIGH | 7.5 |
| nodemailer | GHSA-mm7p-fcc7-pg87 | MODERATE | - |
| esbuild | GHSA-67mh-4wv8-2f99 | MODERATE | 5.3 |
| on-headers | GHSA-76c9-3jph-rj3q | LOW | 3.4 |
| tar-fs | GHSA-vj76-c3g6-qr5v | HIGH | - |

---

## ⚠️ Notas Importantes

1. **drizzle-kit**: A versão 0.31.1 atual tem uma dependência com vulnerabilidade moderada no esbuild. Isso afeta apenas o ambiente de desenvolvimento. Considerar downgrade se crítico.

2. **xlsx**: Esta é a vulnerabilidade mais preocupante, pois está em uso direto no sistema. A atualização pode ter breaking changes.

3. **Ambiente de produção**: As vulnerabilidades do esbuild e drizzle-kit afetam principalmente desenvolvimento, não produção.

4. **express-session**: Vulnerabilidade baixa, mas vale atualizar por precaução.

---

## 🎯 Checklist de Execução

- [ ] Fazer backup do `package.json` e `package-lock.json`
- [ ] Atualizar `multer` para 2.0.2+
- [ ] Atualizar `xlsx` para 0.20.3+
- [ ] Atualizar `nodemailer` para 7.0.7+
- [ ] Executar `npm audit fix --legacy-peer-deps`
- [ ] Rodar `npm audit` novamente para verificar
- [ ] Executar `npm run build` sem erros
- [ ] Testar upload de arquivos
- [ ] Testar exportação Excel
- [ ] Testar envio de emails
- [ ] Fazer commit das alterações
- [ ] Documentar no changelog

---

## 📞 Suporte

Se houver problemas após as atualizações:
1. Restaurar backup: `cp package.json.backup package.json`
2. Reinstalar: `npm install --legacy-peer-deps`
3. Investigar breaking changes na documentação dos pacotes

