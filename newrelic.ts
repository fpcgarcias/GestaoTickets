/**
 * Configuração New Relic
 * Este arquivo deve estar na raiz do projeto
 */

const config = {
  /**
   * Nome da aplicação no New Relic
   * Pode ser sobrescrito pela variável NEW_RELIC_APP_NAME
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'GestaoTickets-Default'],

  /**
   * Chave de licença do New Relic
   * OBRIGATÓRIO - obtida no painel do New Relic
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  /**
   * Nível de log (error, warn, info, debug, trace)
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'logs/newrelic_agent.log'
  },

  /**
   * Configurações de transações
   */
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f', // Capturar transações lentas
    record_sql: 'obfuscated', // Capturar SQL mas mascarar valores
    explain_threshold: 500 // Explicar queries que demoram mais de 500ms
  },

  /**
   * Configurações de erro
   */
  error_collector: {
    enabled: true,
    capture_events: true,
    max_event_samples_stored: 100
  },

  /**
   * Configurações de browser monitoring (RUM)
   */
  browser_monitoring: {
    enable: true
  },

  /**
   * Configurações de aplicação
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    metrics: {
      enabled: true
    }
  },

  /**
   * Distributed tracing
   */
  distributed_tracing: {
    enabled: true
  },

  /**
   * Configurações específicas para Node.js
   */
  rules: {
    name: [
      // Ignorar healthcheck
      { pattern: '/health', name: 'HealthCheck' },
      // Ignorar arquivos estáticos
      { pattern: '/.*\\.(css|js|png|jpg|jpeg|gif|ico|svg)$', ignore: true }
    ]
  },

  /**
   * Configurações de atributos personalizados
   */
  attributes: {
    enabled: true,
    include: [
      'request.headers.userAgent',
      'request.headers.referer',
      'response.statusCode'
    ]
  }
};

export default config;
