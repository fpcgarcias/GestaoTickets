import { intl, detectLocaleFromDomain, createIntlInstance, type SupportedLocale } from '@/i18n';

/**
 * Utilitário para traduzir mensagens de notificações recebidas do servidor
 * que estão em português hardcoded.
 * 
 * Extrai variáveis das mensagens e aplica tradução baseada em padrões conhecidos.
 */

interface TranslationResult {
  title: string;
  message: string;
}

/**
 * Traduz um status de ticket do português para o idioma atual
 */
function translateStatus(ptStatus: string, locale: SupportedLocale): string {
  // Mapeamento de status em português para chaves de tradução
  const statusMap: Record<string, string> = {
    'Novo': 'tickets.new',
    'Em Andamento': 'tickets.ongoing',
    'Suspenso': 'tickets.suspended',
    'Aguardando Cliente': 'tickets.waiting_customer',
    'Escalado': 'tickets.escalated',
    'Em Análise': 'tickets.in_analysis',
    'Aguardando Deploy': 'tickets.pending_deployment',
    'Reaberto': 'tickets.reopened',
    'Resolvido': 'tickets.resolved',
    'Encerrado': 'tickets.closed'
  };

  const key = statusMap[ptStatus];
  if (key) {
    try {
      const intlInstance = createIntlInstance(locale);
      return intlInstance.formatMessage({ id: key });
    } catch (error) {
      console.warn('Erro ao traduzir status:', error);
      return ptStatus;
    }
  }

  return ptStatus;
}

/**
 * Extrai variáveis de uma mensagem em português
 */
function extractVariables(ptMessage: string): Record<string, string> {
  const vars: Record<string, string> = {};

  // Extrair ticket code: #TK-XXXXXX ou #XXXXXX
  const ticketCodeMatch = ptMessage.match(/#([A-Z]+-\d+|\d+)/);
  if (ticketCodeMatch) {
    vars.ticketCode = ticketCodeMatch[1];
  }

  // Extrair título entre aspas: "Título"
  const titleMatch = ptMessage.match(/"([^"]+)"/);
  if (titleMatch) {
    vars.title = titleMatch[1];
  }

  // Extrair nomes de pessoas (geralmente após "por", "de", ou no final)
  // Padrões: "por João Silva", "de João Silva", "João Silva foi..."
  const namePatterns = [
    /por\s+([A-ZÁÊÇÕ][a-záêçõ\s]+?)(?:\.|,|$)/,
    /de\s+([A-ZÁÊÇÕ][a-záêçõ\s]+?)(?:\.|,|$)/,
    /^([A-ZÁÊÇÕ][a-záêçõ\s]+?)\s+(?:foi|respondeu)/,
  ];

  for (const pattern of namePatterns) {
    const match = ptMessage.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!vars.changedBy && !vars.resolvedBy && !vars.addedBy && !vars.removedBy && !vars.createdBy) {
        // Determinar tipo baseado no contexto
        if (ptMessage.includes('resolvido')) {
          vars.resolvedBy = name;
        } else if (ptMessage.includes('alterado')) {
          vars.changedBy = name;
        } else if (ptMessage.includes('adicionado')) {
          if (ptMessage.includes('Você foi adicionado')) {
            vars.addedBy = name;
          } else {
            vars.participantName = name;
            // Procurar quem adicionou
            const addedByMatch = ptMessage.match(/por\s+([A-ZÁÊÇÕ][a-záêçõ\s]+?)(?:\.|$)/);
            if (addedByMatch) vars.addedBy = addedByMatch[1].trim();
          }
        } else if (ptMessage.includes('removido')) {
          if (ptMessage.includes('Você foi removido')) {
            vars.removedBy = name;
          } else {
            vars.participantName = name;
            // Procurar quem removeu
            const removedByMatch = ptMessage.match(/por\s+([A-ZÁÊÇÕ][a-záêçõ\s]+?)(?:\.|$)/);
            if (removedByMatch) vars.removedBy = removedByMatch[1].trim();
          }
        } else if (ptMessage.includes('criado por')) {
          vars.createdBy = name;
        }
      }
      break;
    }
  }

  // Extrair status (padrões comuns)
  const statusPatterns = [
    /alterado de\s+"?([^"]+)"?\s+para\s+"?([^"]+)"?/,
    /alterado de\s+([^"]+)\s+para\s+([^"]+)/,
  ];

  for (const pattern of statusPatterns) {
    const match = ptMessage.match(pattern);
    if (match && match[1] && match[2]) {
      vars.oldStatus = match[1].trim();
      vars.newStatus = match[2].trim();
      break;
    }
  }

  // Extrair email entre parênteses: (email@example.com)
  const emailMatch = ptMessage.match(/\(([^)]+@[^)]+)\)/);
  if (emailMatch) {
    vars.userEmail = emailMatch[1];
  }

  // Extrair horas: "em {X} horas"
  const hoursMatch = ptMessage.match(/em\s+(\d+)\s+horas?/);
  if (hoursMatch) {
    vars.hours = hoursMatch[1];
  }

  // Extrair dias: "em aproximadamente {X} dias"
  const daysMatch = ptMessage.match(/aproximadamente\s+(\d+)\s+dias?/);
  if (daysMatch) {
    vars.days = daysMatch[1];
  }

  return vars;
}

/**
 * Mapeia título e mensagem em português para chaves de tradução
 */
function mapToTranslationKey(ptTitle: string, ptMessage: string): { key: string; vars: Record<string, string> } | null {
  const vars = extractVariables(ptMessage);

  // Mapeamento de títulos conhecidos para chaves de tradução
  const titleMap: Record<string, string> = {
    'Novo Ticket Criado': 'notifications.messages.new_ticket_title',
    'Status do Ticket Atualizado': 'notifications.messages.status_updated_title',
    'Status do Ticket Alterado': 'notifications.messages.status_changed_title',
    'Ticket Resolvido': 'notifications.messages.ticket_resolved_title',
    'Ticket Encerrado': 'notifications.messages.ticket_closed_title',
    'Nova Resposta no Seu Ticket': 'notifications.messages.new_reply_customer_title',
    'Nova Resposta de Cliente': 'notifications.messages.new_reply_client_title',
    'Nova Resposta de Atendente': 'notifications.messages.new_reply_support_title',
    'Você foi adicionado como participante': 'notifications.messages.participant_added_self_title',
    'Novo participante adicionado': 'notifications.messages.participant_added_other_title',
    'Participante adicionado ao ticket': 'notifications.messages.participant_added_department_title',
    'Você foi removido como participante': 'notifications.messages.participant_removed_self_title',
    'Participante removido do ticket': 'notifications.messages.participant_removed_other_title',
    'Novo Usuário Criado': 'notifications.messages.new_user_title',
    'Manutenção do Sistema': 'notifications.messages.system_maintenance_title',
    'Ticket Próximo do Vencimento': 'notifications.messages.ticket_due_soon_title',
    'Ticket Escalado': 'notifications.messages.ticket_escalated_title',
  };

  // Tentar mapear pelo título primeiro
  const titleKey = titleMap[ptTitle];
  if (titleKey) {
    // Determinar a chave da mensagem baseado no título e conteúdo
    let messageKey = '';

    if (ptTitle === 'Novo Ticket Criado') {
      messageKey = 'notifications.messages.new_ticket_message';
    } else if (ptTitle === 'Status do Ticket Atualizado') {
      messageKey = 'notifications.messages.status_updated_message';
    } else if (ptTitle === 'Status do Ticket Alterado') {
      messageKey = 'notifications.messages.status_changed_message';
    } else if (ptTitle === 'Ticket Resolvido') {
      messageKey = 'notifications.messages.ticket_resolved_message';
    } else if (ptTitle === 'Ticket Encerrado') {
      messageKey = 'notifications.messages.ticket_closed_message';
    } else if (ptTitle === 'Nova Resposta no Seu Ticket') {
      messageKey = 'notifications.messages.new_reply_customer_message';
    } else if (ptTitle === 'Nova Resposta de Cliente') {
      messageKey = 'notifications.messages.new_reply_client_message';
    } else if (ptTitle === 'Nova Resposta de Atendente') {
      messageKey = 'notifications.messages.new_reply_support_message';
    } else if (ptTitle === 'Você foi adicionado como participante') {
      messageKey = 'notifications.messages.participant_added_self_message';
    } else if (ptTitle === 'Novo participante adicionado') {
      messageKey = 'notifications.messages.participant_added_other_message';
    } else if (ptTitle === 'Participante adicionado ao ticket') {
      messageKey = 'notifications.messages.participant_added_department_message';
    } else if (ptTitle === 'Você foi removido como participante') {
      messageKey = 'notifications.messages.participant_removed_self_message';
    } else if (ptTitle === 'Participante removido do ticket') {
      messageKey = 'notifications.messages.participant_removed_other_message';
    } else if (ptTitle === 'Novo Usuário Criado') {
      messageKey = 'notifications.messages.new_user_message';
      // Extrair nome do usuário
      const userMatch = ptMessage.match(/O usuário\s+([^(]+)\s*\(/);
      if (userMatch) {
        vars.userName = userMatch[1].trim();
      }
    } else if (ptTitle === 'Ticket Próximo do Vencimento') {
      // Mensagens variáveis baseadas no tempo
      if (ptMessage.includes('menos de 1 hora')) {
        messageKey = 'notifications.messages.ticket_due_soon_critical';
      } else if (ptMessage.includes('horas')) {
        messageKey = 'notifications.messages.ticket_due_soon_high';
      } else {
        messageKey = 'notifications.messages.ticket_due_soon_days';
      }
    } else if (ptTitle === 'Ticket Escalado') {
      messageKey = 'notifications.messages.ticket_escalated_message';
      // Verificar se tem "por {nome}"
      if (ptMessage.includes('por ')) {
        const escalatedByMatch = ptMessage.match(/por\s+([^.]+)/);
        if (escalatedByMatch) {
          vars.escalatedBy = escalatedByMatch[1].trim();
        }
      }
    }

    if (messageKey) {
      return { key: messageKey, vars };
    }
  }

  // Se não encontrou mapeamento, retorna null para usar fallback
  return null;
}

/**
 * Traduz uma notificação do português para o idioma atual do sistema
 */
export function translateNotification(
  ptTitle: string,
  ptMessage: string,
  locale?: SupportedLocale
): TranslationResult {
  const currentLocale = locale || detectLocaleFromDomain();

  // Se já está em português e o sistema está em português, retornar como está
  if (currentLocale === 'pt-BR') {
    return { title: ptTitle, message: ptMessage };
  }

  // Tentar mapear para chave de tradução
  const mapping = mapToTranslationKey(ptTitle, ptMessage);

  if (!mapping) {
    // Fallback: retornar mensagem original se não encontrou mapeamento
    return { title: ptTitle, message: ptMessage };
  }

  try {
    // Criar instância de intl para o locale atual
    const intlInstance = createIntlInstance(currentLocale);

    // Traduzir título
    const titleKeyMap: Record<string, string> = {
      'Novo Ticket Criado': 'notifications.messages.new_ticket_title',
      'Status do Ticket Atualizado': 'notifications.messages.status_updated_title',
      'Status do Ticket Alterado': 'notifications.messages.status_changed_title',
      'Ticket Resolvido': 'notifications.messages.ticket_resolved_title',
      'Ticket Encerrado': 'notifications.messages.ticket_closed_title',
      'Nova Resposta no Seu Ticket': 'notifications.messages.new_reply_customer_title',
      'Nova Resposta de Cliente': 'notifications.messages.new_reply_client_title',
      'Nova Resposta de Atendente': 'notifications.messages.new_reply_support_title',
      'Você foi adicionado como participante': 'notifications.messages.participant_added_self_title',
      'Novo participante adicionado': 'notifications.messages.participant_added_other_title',
      'Participante adicionado ao ticket': 'notifications.messages.participant_added_department_title',
      'Você foi removido como participante': 'notifications.messages.participant_removed_self_title',
      'Participante removido do ticket': 'notifications.messages.participant_removed_other_title',
      'Novo Usuário Criado': 'notifications.messages.new_user_title',
      'Manutenção do Sistema': 'notifications.messages.system_maintenance_title',
      'Ticket Próximo do Vencimento': 'notifications.messages.ticket_due_soon_title',
      'Ticket Escalado': 'notifications.messages.ticket_escalated_title',
    };

    const titleKey = titleKeyMap[ptTitle];
    const translatedTitle = titleKey 
      ? intlInstance.formatMessage({ id: titleKey })
      : ptTitle;

    // Traduzir mensagem com variáveis
    let translatedMessage = '';
    
    if (mapping.key) {
      const messageVars = { ...mapping.vars };
      
      // 🔥 TRADUZIR STATUS: Se a mensagem contém status, traduzi-los para o idioma atual
      if (messageVars.oldStatus) {
        messageVars.oldStatus = translateStatus(messageVars.oldStatus, currentLocale);
      }
      if (messageVars.newStatus) {
        messageVars.newStatus = translateStatus(messageVars.newStatus, currentLocale);
      }
      
      // Para ticket_escalated_message, construir o texto "por {escalatedBy}" se necessário
      if (mapping.key === 'notifications.messages.ticket_escalated_message') {
        if (messageVars.escalatedBy) {
          // Adicionar o texto " por {escalatedBy}" usando a chave de tradução
          const byText = intlInstance.formatMessage(
            { id: 'notifications.messages.ticket_escalated_message_with_by' },
            { escalatedBy: messageVars.escalatedBy }
          );
          // A chave ticket_escalated_message já tem o placeholder {escalatedBy}
          messageVars.escalatedBy = byText;
        } else {
          messageVars.escalatedBy = '';
        }
      }
      
      translatedMessage = intlInstance.formatMessage({ id: mapping.key }, messageVars);
    } else {
      translatedMessage = ptMessage;
    }

    return {
      title: translatedTitle,
      message: translatedMessage || ptMessage,
    };
  } catch (error) {
    console.warn('Erro ao traduzir notificação:', error);
    // Fallback em caso de erro
    return { title: ptTitle, message: ptMessage };
  }
}
