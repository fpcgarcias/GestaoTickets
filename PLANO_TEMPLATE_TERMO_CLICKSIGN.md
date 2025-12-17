# Plano de Implementação: Template de Termo de Responsabilidade e Integração Clicksign

## Objetivo
Criar template HTML para termos de responsabilidade baseado no modelo fornecido e integrar com Clicksign para assinatura digital.

## Análise do Modelo Fornecido

O termo deve conter:
1. **Logo e Nome da Empresa** (topo)
2. **Título**: "TERMO DE RESPONSABILIDADE PELA GUARDA E USO DO EQUIPAMENTO DE TRABALHO"
3. **Seção de Identificação do Empregado**:
   - Nome
   - CPF
   - Telefone para contato
   - E-mail
4. **Texto Principal** (cláusulas de responsabilidade)
5. **Tabela de Equipamentos**:
   - Coluna "EQUIPAMENTO" (nome do produto)
   - Coluna "SERIAL NUMBER" (número de série)
6. **Data e Local**
7. **Assinaturas**:
   - Funcionário(a)
   - Responsável da entrega

## Estrutura de Dados

### Dados da Empresa (já disponíveis)
- `company.name` - Nome da empresa
- `company.cnpj` - CNPJ da empresa
- `company.phone` - Telefone (opcional)

### Dados do Usuário (parcialmente disponíveis)
- `user.name` - Nome completo ✅
- `user.email` - E-mail ✅
- `user.phone` - Telefone (precisa buscar de customers ou adicionar campo)
- `user.cpf` - CPF (NÃO EXISTE - precisa adicionar campo ou tornar opcional)

### Dados dos Equipamentos (já disponíveis)
- `product.name` - Nome do equipamento
- `product.serial_number` - Número de série
- `product.brand` - Marca (opcional)
- `product.model` - Modelo (opcional)
- `product.asset_number` - Patrimônio (opcional)

## Implementação

### 1. Template HTML Base

Criar template HTML com estrutura similar ao modelo, usando variáveis:
- `{{companyName}}` - Nome da empresa
- `{{companyCnpj}}` - CNPJ formatado
- `{{userName}}` - Nome do funcionário
- `{{userCpf}}` - CPF (opcional, pode ser "--" se não informado)
- `{{userPhone}}` - Telefone (opcional)
- `{{userEmail}}` - E-mail
- `{{today}}` - Data atual formatada
- `{{city}}` - Cidade (pode vir de configuração da empresa)
- `{{productsTable}}` - Tabela HTML com equipamentos
- `{{assignedDate}}` - Data de alocação
- `{{expectedReturnDate}}` - Data prevista de devolução

### 2. Adicionar Campos Opcionais ao Usuário

**Opção A (Recomendada)**: Adicionar campos `cpf` e `phone` na tabela `users`
- Migration para adicionar colunas
- Atualizar schema TypeScript
- Atualizar formulários de cadastro/edição de usuário

**Opção B**: Usar dados de `customers` quando disponível
- Buscar customer relacionado ao user_id
- Usar phone do customer se disponível

### 3. Atualizar buildTemplateContext()

Adicionar novos campos ao contexto:
- `userCpf`: Buscar de users.cpf ou customers (se existir)
- `userPhone`: Buscar de users.phone ou customers.phone
- `city`: Configuração da empresa ou padrão "Rio de Janeiro"

### 4. Template HTML Completo

Criar template com:
- Estilo CSS inline para impressão/PDF
- Estrutura similar ao modelo fornecido
- Tabela de equipamentos dinâmica
- Campos de assinatura (serão preenchidos pelo Clicksign)

### 5. Integração com Clicksign

**Como funciona o Clicksign:**
- Aceita upload de PDF via API
- Permite definir posições de assinatura no documento
- Envia e-mail para assinantes
- Retorna URL de assinatura
- Webhook para notificar quando assinado

**Implementação:**
1. Criar provider `ClicksignProvider` implementando `SignatureProvider`
2. Usar API do Clicksign para:
   - Upload do PDF (já temos no S3, pode usar URL)
   - Criar documento
   - Adicionar signatários
   - Definir posições de assinatura (coordenadas X, Y no PDF)
   - Enviar para assinatura
3. Armazenar `requestId` e `signingUrl` no `signature_data`
4. Implementar webhook handler para receber notificações

**Dados necessários para Clicksign:**
- Access Token (variável de ambiente)
- PDF URL (já temos no S3)
- Nome e e-mail do signatário (já temos)
- Posições de assinatura (coordenadas no PDF)

### 6. Configuração de Assinaturas

Adicionar campos de posição de assinatura no template ou calcular automaticamente:
- Assinatura do funcionário: final do documento
- Assinatura do responsável: ao lado ou abaixo

## Arquivos a Modificar/Criar

1. **Migration**: Adicionar campos `cpf` e `phone` em `users` (opcional)
2. **shared/schema.ts**: Atualizar tipos
3. **server/services/responsibility-term-service.ts**: 
   - Atualizar `buildTemplateContext()` e `buildBatchTemplateContext()`
   - Adicionar método para buscar dados completos do usuário
4. **server/services/digital-signature-service.ts**: 
   - Implementar `ClicksignProvider` real
   - Substituir `MockSignatureProvider` por implementação real
5. **Template HTML**: Criar template base no banco de dados (via interface ou seed)
6. **server/api/responsibility-terms.ts**: Endpoint para enviar para Clicksign

## Variáveis de Ambiente Necessárias

```env
CLICKSIGN_ACCESS_TOKEN=seu_token_aqui
CLICKSIGN_API_URL=https://api.clicksign.com (ou URL da API)
SIGNATURE_PROVIDER=clicksign
```

## Fluxo Completo

1. Usuário gera termo (já implementado)
2. PDF é gerado e salvo no S3 (já implementado)
3. Usuário clica em "Enviar para assinatura"
4. Sistema:
   - Busca PDF do S3
   - Faz upload para Clicksign (ou envia URL se suportado)
   - Cria documento no Clicksign
   - Adiciona signatários (funcionário + responsável da entrega)
   - Define posições de assinatura
   - Envia para assinatura
   - Salva `requestId` e `signingUrl` no banco
5. Clicksign envia e-mail para signatários
6. Signatários assinam via Clicksign
7. Clicksign envia webhook quando assinado
8. Sistema atualiza status do termo para "signed"

## Questões a Resolver

1. **CPF do usuário**: Adicionar campo ou tornar opcional?
2. **Telefone do usuário**: Usar de `customers` ou adicionar em `users`?
3. **Cidade**: Configuração por empresa ou fixo?
4. **Posições de assinatura**: Fixas no template ou configuráveis?
5. **Responsável da entrega**: Quem assina? (usuário que criou a movimentação?)

## Próximos Passos

1. Decidir sobre campos CPF e telefone
2. Criar template HTML base
3. Atualizar contexto do template
4. Implementar provider Clicksign real
5. Criar interface para enviar para assinatura
6. Implementar webhook handler

