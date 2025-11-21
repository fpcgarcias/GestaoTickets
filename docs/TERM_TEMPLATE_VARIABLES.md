# Variáveis Disponíveis para Templates de Termos de Responsabilidade

Este documento lista todas as variáveis disponíveis para uso nos templates de termos de responsabilidade.

## Formato das Variáveis

As variáveis devem ser usadas no formato `{{nomeDaVariavel}}` no template HTML.

## Variáveis de Empresa

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{companyName}}` | Nome da empresa | "VIX VAREJO LTDA" |
| `{{companyDocument}}` | CNPJ da empresa formatado | "40.832.444/0001-08" |
| `{{companyCity}}` | Cidade da empresa | "Rio de Janeiro" |

## Variáveis de Usuário/Funcionário

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{userName}}` | Nome completo do funcionário | "João Silva" |
| `{{userEmail}}` | E-mail do funcionário | "joao.silva@empresa.com" |
| `{{userCpf}}` | CPF formatado do funcionário | "123.456.789-00" ou "--" se não informado |
| `{{userPhone}}` | Telefone do funcionário | "(21) 99999-9999" ou "--" se não informado |

## Variáveis de Alocação

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{assignmentId}}` | ID da alocação | "123" |
| `{{assignedDate}}` | Data de alocação formatada | "18/11/2025" |
| `{{expectedReturnDate}}` | Data prevista de devolução | "18/11/2026" ou "Não informado" |

## Variáveis de Data

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{today}}` | Data atual completa formatada | "18/11/2025" |
| `{{todayDay}}` | Dia do mês (2 dígitos) | "18" |
| `{{todayMonth}}` | Nome do mês por extenso | "novembro" |
| `{{todayYear}}` | Ano (4 dígitos) | "2025" |

## Variáveis de Produtos/Equipamentos

### Para Termos Únicos

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{productName}}` | Nome do produto | "Notebook Dell Latitude" |
| `{{productBrand}}` | Marca do produto | "Dell" |
| `{{productModel}}` | Modelo do produto | "Latitude 15 3550" |
| `{{productSerial}}` | Número de série | "ABC123XYZ" |
| `{{productAsset}}` | Número de patrimônio | "PAT-001" |

### Para Termos em Lote

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{productsCount}}` | Quantidade de produtos | "3" |
| `{{productsList}}` | Lista HTML de produtos (ul/li) | `<ul><li>1. Notebook...</li></ul>` |
| `{{productsTable}}` | Tabela HTML completa de produtos | Tabela com colunas EQUIPAMENTO e SERIAL NUMBER |

**Nota:** `{{productsTable}}` é a variável recomendada para termos em lote, pois gera uma tabela formatada automaticamente.

## Variáveis de Responsável da Entrega

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{deliveryResponsibleName}}` | Nome do responsável pela entrega | "Maria Santos" |

## Exemplo de Uso no Template

```html
<div class="field">
  <span class="field-label">Nome:</span>
  <span class="field-value">{{userName}}</span>
</div>

<div class="field">
  <span class="field-label">CPF:</span>
  <span class="field-value">{{userCpf}}</span>
</div>

<p>
  Recebi da empresa <strong>{{companyName}}</strong>, 
  CNPJ nº <strong>{{companyDocument}}</strong>, 
  os equipamentos especificados neste termo.
</p>

<!-- Para termos em lote, use productsTable -->
{{productsTable}}

<!-- Para termos únicos, use as variáveis individuais -->
<div>
  Equipamento: {{productName}}<br>
  Marca: {{productBrand}}<br>
  Modelo: {{productModel}}<br>
  Serial: {{productSerial}}
</div>

<div class="date-location">
  {{companyCity}}, {{todayDay}} de {{todayMonth}} de {{todayYear}}.
</div>
```

## Observações Importantes

1. **Formatação Automática**: CPF e CNPJ são formatados automaticamente (adicionando pontos, barras e hífens).

2. **Valores Padrão**: Se uma informação não estiver disponível:
   - CPF: será exibido como "--"
   - Telefone: será exibido como "--"
   - Data de devolução: será exibido como "Não informado"

3. **Tabela de Produtos**: A variável `{{productsTable}}` gera automaticamente uma tabela HTML completa com estilo, incluindo:
   - Cabeçalho: "EQUIPAMENTO" e "SERIAL NUMBER"
   - Linhas para cada produto
   - Estilos CSS inline para impressão/PDF

4. **Compatibilidade**: Todas as variáveis funcionam tanto para termos únicos quanto para termos em lote. Para termos únicos, `{{productsTable}}` mostrará apenas um produto.


