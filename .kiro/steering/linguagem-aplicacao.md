---
inclusion: always
---

# Sistema de Internacionalização (i18n)

## Idiomas Suportados

Este sistema é **bilíngue** e suporta:
- **Português Brasileiro (pt-BR)** - idioma padrão
- **Inglês Americano (en-US)**

## Regras Obrigatórias

### 1. Todas as strings visíveis ao usuário DEVEM ser internacionalizadas

- **NUNCA** use strings hardcoded em componentes React
- **SEMPRE** use o hook `useI18n()` e o método `formatMessage()`
- Textos em botões, labels, mensagens de erro, tooltips, placeholders - tudo deve estar nos arquivos de tradução

### 2. Estrutura de Arquivos de Tradução

Os arquivos de mensagens estão localizados em:
- `client/src/i18n/messages/pt-BR.json`
- `client/src/i18n/messages/en-US.json`

**Estrutura hierárquica:**
```json
{
  "auth": {
    "login_tab": "Login",
    "register_tab": "Cadastro"
  },
  "tickets": {
    "title": "Chamados",
    "new_ticket": "Novo Chamado"
  }
}
```

### 3. Como Usar no Código

```tsx
import { useI18n } from '@/i18n';

function MyComponent() {
  const { formatMessage } = useI18n();
  
  return (
    <button>
      {formatMessage('tickets.new_ticket')}
    </button>
  );
}
```

**Com variáveis dinâmicas:**
```tsx
formatMessage('tickets.assigned_to', { name: userName })
```

### 4. Ao Criar/Modificar Funcionalidades

Quando você criar ou modificar qualquer funcionalidade:

1. **Identifique todas as strings visíveis** ao usuário
2. **Adicione as chaves de tradução** em AMBOS os arquivos (`pt-BR.json` e `en-US.json`)
3. **Use chaves descritivas** seguindo o padrão hierárquico (ex: `module.action.description`)
4. **Mantenha consistência** entre os dois arquivos (mesmas chaves em ambos)

### 5. Detecção de Idioma

O sistema detecta o idioma baseado em:
1. **Query parameter** `?lang=pt-BR` ou `?lang=en-US` (desenvolvimento)
2. **localStorage** `dev-lang` (desenvolvimento local)
3. **Domínio fixo** (ex: `vixpaulahermanny.com` → sempre inglês)
4. **Idioma do navegador** (para domínios genéricos)
5. **Fallback** para pt-BR

### 6. Biblioteca Utilizada

- **react-intl** para gerenciamento de traduções
- Hook customizado `useI18n()` para facilitar o uso
- Suporte a formatação de datas, números e mensagens com variáveis

## Checklist para Novas Features

- [ ] Todas as strings estão nos arquivos de tradução?
- [ ] As traduções existem em pt-BR E en-US?
- [ ] As chaves seguem o padrão hierárquico?
- [ ] Testei alternando entre os idiomas?
- [ ] Mensagens de erro também estão traduzidas?

## Exemplos Práticos

**❌ ERRADO:**
```tsx
<button>Novo Chamado</button>
<p>Erro ao salvar</p>
```

**✅ CORRETO:**
```tsx
const { formatMessage } = useI18n();

<button>{formatMessage('tickets.new_ticket')}</button>
<p>{formatMessage('errors.save_failed')}</p>
```