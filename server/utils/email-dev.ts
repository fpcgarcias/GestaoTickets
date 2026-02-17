/**
 * Controle de envio de e-mail em ambiente de desenvolvimento.
 * Evita que e-mails de teste disparem para solicitantes reais (ex.: quando o banco é cópia da produção).
 *
 * Variáveis de ambiente:
 * - EMAIL_DEV_DISABLE=true  → em dev, não envia nenhum e-mail (apenas log).
 * - EMAIL_DEV_OVERRIDE=email@exemplo.com → em dev, redireciona todos os destinatários para este e-mail.
 *
 * Se NODE_ENV !== 'production' e nenhuma das duas estiver definida, o padrão é NÃO enviar (segurança).
 */

const isDev = process.env.NODE_ENV !== 'production';

export interface ResolveDevEmailResult {
  /** false = não enviar (dev sem override ou DISABLE); true = enviar (produção ou dev com OVERRIDE) */
  send: boolean;
  /** Destinatário efetivo (pode ser o override em dev) */
  to: string;
  /** Destinatário original (para log) */
  originalTo: string;
}

/**
 * Define se deve enviar o e-mail e para qual endereço em ambiente de desenvolvimento.
 * Em produção, sempre retorna send: true e to = recipient.
 */
export function resolveDevEmail(recipient: string): ResolveDevEmailResult {
  const originalTo = recipient;

  if (!isDev) {
    return { send: true, to: recipient, originalTo };
  }

  const disable = process.env.EMAIL_DEV_DISABLE;
  if (disable === 'true' || disable === '1') {
    return { send: false, to: recipient, originalTo };
  }

  const override = process.env.EMAIL_DEV_OVERRIDE?.trim();
  if (override && override.includes('@')) {
    return { send: true, to: override, originalTo };
  }

  // Dev sem config: não enviar por segurança
  return { send: false, to: recipient, originalTo };
}
