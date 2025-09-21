/**
 * Configuração New Relic
 * Este arquivo DEVE estar na raiz do projeto e ser um .js
 */

'use strict';

exports.config = {
  /**
   * Nome da aplicação no New Relic
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'GestaoTickets-Default'],

  /**
   * Chave de licença do New Relic - OBRIGATÓRIO
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  /**
   * Nível de log
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
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: 500
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
   * Browser monitoring
   */
  browser_monitoring: {
    enable: true
  },

  /**
   * Application logging
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
   * Regras específicas para nomeação de transações
   */
  rules: {
    name: [
      // Healthcheck
      { pattern: '/health', name: 'HealthCheck' },
      
      // APIs específicas
      { pattern: '/api/tickets', name: 'API-Tickets' },
      { pattern: '/api/tickets/.*', name: 'API-Tickets-Detail' },
      { pattern: '/api/users', name: 'API-Users' },
      { pattern: '/api/users/.*', name: 'API-Users-Detail' },
      { pattern: '/api/departments', name: 'API-Departments' },
      { pattern: '/api/sla-dashboard', name: 'API-SLA-Dashboard' },
      { pattern: '/api/dashboard', name: 'API-Dashboard' },
      { pattern: '/api/reports', name: 'API-Reports' },
      { pattern: '/api/logs', name: 'API-Logs' },
      
      // Ignorar arquivos estáticos
      { pattern: '/.*\\.(css|js|png|jpg|jpeg|gif|ico|svg)$', ignore: true }
    ]
  },

  /**
   * Atributos personalizados
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
