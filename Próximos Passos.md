�� PLANO COMPLETO - PESQUISA DE SATISFAÇÃO MULTI-EMPRESAS
📋 RESUMO EXECUTIVO
Sistema de pesquisa de satisfação automática que envia email personalizado por empresa quando tickets são resolvidos, com dashboard gerencial completo e controle de ativação por empresa.
��️ 1. ESTRUTURA DO BANCO DE DADOS
1.1 Nova Tabela: satisfaction_surveys
1.2 Configuração por Empresa
Tabela: system_settings (já existe)
Key: satisfaction_survey_enabled
Value: true ou false
Padrão: false (desabilitado)
1.3 Enum de Templates de Email
Adicionar: satisfaction_survey ao enum email_template_type
⚙️ 2. CONFIGURAÇÕES DO SISTEMA
2.1 Interface de Configuração
Localização: Tela de configurações existente
Permissões: admin e company_admin apenas
Campo: Checkbox "Ativar Pesquisa de Satisfação"
Comportamento: Salva na tabela system_settings
2.2 Validação de Permissões
Backend: Middleware de autorização
Frontend: Componente condicional baseado em role
📧 3. SISTEMA DE EMAIL
3.1 Template de Email
Tipo: satisfaction_survey
Design: Moderno, responsivo, com schema de cores da empresa
Variáveis disponíveis:
{{ticket.ticket_id}}
{{ticket.title}}
{{customer.name}}
{{survey.link}} (link personalizado por domínio)
{{system.colors.*}} (cores da empresa)
{{system.company_name}}
3.2 Integração com Templates Padrão
Localização: Botão "Criar Templates Padrão"
Comportamento: Verifica se template de satisfação existe, se não, cria automaticamente
3.3 Geração de Links Personalizados
Formato: {{system.base_url}}/satisfaction/{{survey.token}}
Exemplos:
VIX: https://suporte.vixbrasil.com/satisfaction/abc123
Oficina Muda: https://suporte.oficinamuda.com.br/satisfaction/abc123
TicketWise: https://app.ticketwise.com.br/satisfaction/abc123
�� 4. FLUXO DE FUNCIONAMENTO
4.1 Quando Ticket é Resolvido
Verificar se empresa tem satisfaction_survey_enabled = true
Se ativado:
Gerar token único
Criar registro na tabela satisfaction_surveys
Enviar email com link personalizado
Se desativado: Não fazer nada
4.2 Processo de Resposta
Cliente clica no link
Validação de token e expiração
Exibir formulário de pesquisa
Cliente responde (rating + comentários opcionais)
Salvar resposta e marcar como respondida
�� 5. FRONTEND
5.1 Página de Pesquisa
Rota: /satisfaction/[token]
Design: Página pública, responsiva, com branding da empresa
Componentes:
Header com logo da empresa
Formulário de rating (1-5 estrelas)
Campo de comentários (opcional)
Botão de envio
Página de agradecimento
5.2 Validações
Token válido e não expirado
Domínio correto da empresa
Rate limiting para evitar spam
�� 6. DASHBOARD GERENCIAL
6.1 Permissões de Acesso
Permitido: admin, company_admin, manager, supervisor
Negado: customer, support, viewer, triage, quality, integration_bot
6.2 Filtros Disponíveis
Período: Data início/fim
Departamento:
Só aparece se usuário tem múltiplos departamentos
Se tem apenas 1 departamento: não exibe dropdown
Atendente: Filtra por atendente (respeitando departamentos do usuário)
6.3 Métricas Exibidas
Taxa de resposta: % de pesquisas respondidas
Média de satisfação: Rating médio por período
Distribuição de ratings: Gráfico de barras (1-5 estrelas)
Comentários recentes: Lista dos últimos comentários
Evolução temporal: Gráfico de linha da satisfação ao longo do tempo
Comparativo por departamento: Se múltiplos departamentos
6.4 Layout do Dashboard
Cards de métricas no topo
Gráficos na parte central
Tabela de comentários na parte inferior
Filtros na lateral ou topo
🔒 7. SEGURANÇA E VALIDAÇÕES
7.1 Validações de Token
Token único e não reutilizável
Expiração em 7 dias
Validação de domínio da empresa
7.2 Rate Limiting
Máximo 1 resposta por token
Proteção contra spam no endpoint
7.3 Validações de Empresa
company_id obrigatório em todas as operações
Validação de permissões por empresa
Isolamento total entre empresas
🚀 8. ORDEM DE IMPLEMENTAÇÃO RECOMENDADA
Estrutura do banco (tabela + enum + configuração)
Configurações (interface + backend)
Template de email (criação + integração)
Serviço de email (envio automático)
Endpoint de resposta (receber dados)
Página de pesquisa (frontend público)
Dashboard gerencial (métricas + filtros)
Testes e ajustes finais
✅ CRITÉRIOS DE APROVAÇÃO
[ ] Multi-empresas: company_id obrigatório em tudo
[ ] Domínios personalizados funcionando
[ ] Configuração de ativação por empresa
[ ] Template com cores personalizadas
[ ] Dashboard com filtros condicionais
[ ] Permissões corretas (gerencial apenas)
[ ] Expiração de 7 dias
[ ] Sem integração com SLA
[ ] Sem notificações de resposta
Este plano está 100% alinhado com seus requisitos? Posso começar a implementação?