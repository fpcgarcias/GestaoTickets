# Guia de Migração para GPT-5

## Visão Geral

Este guia documenta as mudanças implementadas para suportar os novos modelos GPT-5 no sistema de gestão de tickets. As atualizações incluem novos parâmetros específicos do GPT-5, reorganização dos modelos disponíveis e melhorias na interface de configuração.

## Principais Mudanças

### 1. Novos Parâmetros GPT-5

#### `max_completion_tokens`
- **Descrição**: Substitui o parâmetro `max_tokens` para modelos GPT-5
- **Valor padrão**: 1500
- **Uso**: Controla o número máximo de tokens na resposta gerada

#### `reasoning_effort`
- **Descrição**: Controla o nível de raciocínio do modelo
- **Opções**: 'low', 'medium', 'high'
- **Valor padrão**: 'medium'
- **Uso**: Ajusta a profundidade de análise e raciocínio do modelo

#### `verbosity`
- **Descrição**: Controla o nível de detalhamento das respostas
- **Opções**: 'low', 'medium', 'high'
- **Valor padrão**: 'medium'
- **Uso**: Define quão detalhadas serão as respostas do modelo

### 2. Parâmetros Modificados

#### `temperature`
- **Mudança**: Fixado em '1' para modelos GPT-5
- **Motivo**: Otimização específica para GPT-5
- **Interface**: Campo desabilitado quando GPT-5 é selecionado

#### `max_tokens`
- **Status**: Marcado como DEPRECATED para GPT-5
- **Substituído por**: `max_completion_tokens`
- **Interface**: Campo desabilitado com nota explicativa

### 3. Reorganização dos Modelos

#### Modelos Prioritários (GPT-5 Series)
- gpt-5-mini
- gpt-5-turbo
- gpt-5-pro
- gpt-5-ultra
- gpt-5-reasoning
- gpt-5-creative
- gpt-5-code
- gpt-5-analysis

#### O-Series (Reasoning Models)
- o1-preview
- o1-mini
- o1-pro
- o1-reasoning-alpha

#### Modelos Legacy
- GPT-4.5 Orion (marcado como legacy)
- GPT-4.1 (marcado como legacy)
- GPT-4o (marcado como legacy)
- GPT-4 Turbo (marcado como legacy)
- GPT-4 (marcado como legacy)
- GPT-3.5 (marcado como deprecated)

## Arquivos Modificados

### Frontend (`client/src/components/ai-settings.tsx`)
1. **Formulários de configuração**: Adicionados novos campos para parâmetros GPT-5
2. **Lista de modelos**: Reorganizada com foco em GPT-5
3. **Validação**: Campos condicionais baseados no modelo selecionado
4. **Interface**: Campos desabilitados/habilitados dinamicamente

### Backend (`server/api/ai-configurations.ts`)
1. **API de criação**: Suporte aos novos parâmetros GPT-5
2. **API de atualização**: Suporte aos novos parâmetros GPT-5
3. **Validação**: Inclusão dos novos campos na validação

### Schema (`shared/schema.ts`)
1. **Tabela aiConfigurations**: Novos campos adicionados
2. **Valores padrão**: Atualizados para GPT-5
3. **Tipos**: Definições para os novos parâmetros

## Como Usar

### Configurando um Modelo GPT-5

1. **Acesse as configurações de IA**
2. **Selecione um modelo GPT-5** da lista (ex: gpt-5-mini)
3. **Configure os novos parâmetros**:
   - `max_completion_tokens`: Ajuste conforme necessário (padrão: 1500)
   - `reasoning_effort`: Escolha entre low/medium/high (padrão: medium)
   - `verbosity`: Escolha entre low/medium/high (padrão: medium)
4. **Observe que**:
   - `temperature` será automaticamente fixado em '1'
   - `max_tokens` será desabilitado (use `max_completion_tokens`)

### Migrando Configurações Existentes

1. **Configurações GPT-4/4o existentes**: Continuarão funcionando normalmente
2. **Para migrar para GPT-5**:
   - Edite a configuração existente
   - Altere o modelo para um da série GPT-5
   - Configure os novos parâmetros conforme necessário
   - Salve as alterações

## Compatibilidade

### Modelos Suportados
- ✅ **GPT-5 Series**: Totalmente suportado com novos parâmetros
- ✅ **O-Series**: Suportado com parâmetros padrão
- ✅ **GPT-4.5/4.1**: Suportado (legacy)
- ✅ **GPT-4o/4 Turbo**: Suportado (legacy)
- ⚠️ **GPT-3.5**: Suportado mas deprecated

### Retrocompatibilidade
- Todas as configurações existentes continuam funcionando
- Novos parâmetros têm valores padrão seguros
- Interface adapta-se automaticamente ao modelo selecionado

## Troubleshooting

### Problemas Comuns

1. **Campo desabilitado**: Verifique se o modelo selecionado suporta o parâmetro
2. **Erro de validação**: Certifique-se de que todos os campos obrigatórios estão preenchidos
3. **Modelo não encontrado**: Verifique se o modelo está na lista atualizada

### Logs e Debugging

- Verifique os logs do servidor para erros de API
- Use as ferramentas de desenvolvedor do navegador para debug do frontend
- Confirme que o schema do banco de dados foi atualizado

## Próximos Passos

1. **Teste as configurações** com diferentes modelos GPT-5
2. **Monitore o desempenho** dos novos parâmetros
3. **Colete feedback** dos usuários sobre a nova interface
4. **Considere deprecar** modelos muito antigos no futuro

## Suporte

Para dúvidas ou problemas relacionados à migração GPT-5, consulte:
- Documentação técnica do projeto
- Logs do sistema
- Este guia de migração

---

**Data da atualização**: Janeiro 2025  
**Versão**: 1.0  
**Compatibilidade**: GPT-5 Series, O-Series, GPT-4.x (legacy)