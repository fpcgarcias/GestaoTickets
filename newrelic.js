/**
 * Configuracao New Relic
 * Este arquivo DEVE estar na raiz do projeto e ser um .js
 */

'use strict';

exports.config = {
  /**
   * Nome da aplicacao no New Relic
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'GestaoTickets-Default'],

  /**
   * Valor Apdex (segundos) para medir satisfacao em requisicoes
   */
  apdex_t: Number.parseFloat(process.env.NEW_RELIC_APDEX_T || '0.5'),

  /**
   * Chave de licenca do New Relic - OBRIGATORIO
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  /**
   * Nivel de log
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'logs/newrelic_agent.log'
  },

  /**
   * Configuracoes de transacoes
   */
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated',
    explain_threshold: Number.parseInt(process.env.NEW_RELIC_EXPLAIN_THRESHOLD || '500', 10),
    top_n: {
      stored_procedures: Number.parseInt(process.env.NEW_RELIC_TOP_N_STORED_PROCS || '200', 10),
      web: Number.parseInt(process.env.NEW_RELIC_TOP_N_WEB || '20', 10),
      background: Number.parseInt(process.env.NEW_RELIC_TOP_N_BACKGROUND || '20', 10)
    }
  },

  /**
   * Captura de SQL lento em bancos PostgreSQL/Neon
   */
  slow_sql: {
    enabled: true,
    max_samples: Number.parseInt(process.env.NEW_RELIC_SLOW_SQL_MAX_SAMPLES || '100', 10)
  },

  /**
   * Eventos de transacao e spans
   */
  transaction_events: {
    enabled: true,
    max_samples_stored: Number.parseInt(process.env.NEW_RELIC_TRANSACTION_EVENTS_MAX || '2000', 10),
    sampling_rate: Number.parseFloat(process.env.NEW_RELIC_TRANSACTION_EVENTS_RATE || '0.3')
  },
  span_events: {
    enabled: true,
    max_samples_stored: Number.parseInt(process.env.NEW_RELIC_SPAN_EVENTS_MAX || '2000', 10),
    sampling_rate: Number.parseFloat(process.env.NEW_RELIC_SPAN_EVENTS_RATE || '0.5')
  },

  /**
   * Configuracoes de erro
   */
  error_collector: {
    enabled: true,
    capture_events: true,
    max_event_samples_stored: Number.parseInt(process.env.NEW_RELIC_ERROR_EVENTS_MAX || '100', 10)
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
      max_samples_stored: Number.parseInt(process.env.NEW_RELIC_FORWARDING_LOGS_MAX || '10000', 10)
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
   * Rastreamento de Postgres/Neon e chamadas externas
   */
  datastore_tracer: {
    instance_reporting: {
      enabled: process.env.NEW_RELIC_DATASTORE_INSTANCE !== 'false'
    },
    database_name_reporting: {
      enabled: process.env.NEW_RELIC_DATASTORE_DBNAME !== 'false'
    }
  },
  external_service: {
    enabled: true,
    max_event_samples_stored: Number.parseInt(process.env.NEW_RELIC_EXTERNAL_EVENTS_MAX || '200', 10),
    max_samples_per_minute: Number.parseInt(process.env.NEW_RELIC_EXTERNAL_EVENTS_PER_MIN || '100', 10)
  },

  /**
   * Regras especificas para nomeacao de transacoes
   */
  rules: {
    name: [
      { pattern: '/health', name: 'HealthCheck' },
      { pattern: '/api/tickets', name: 'API-Tickets' },
      { pattern: '/api/tickets/.*', name: 'API-Tickets-Detail' },
      { pattern: '/api/users', name: 'API-Users' },
      { pattern: '/api/users/.*', name: 'API-Users-Detail' },
      { pattern: '/api/departments', name: 'API-Departments' },
      { pattern: '/api/sla-dashboard', name: 'API-SLA-Dashboard' },
      { pattern: '/api/dashboard', name: 'API-Dashboard' },
      { pattern: '/api/reports', name: 'API-Reports' },
      { pattern: '/api/logs', name: 'API-Logs' },
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
      'request.method',
      'request.uri',
      'response.statusCode',
      'ticket.*',
      'tenant.*'
    ]
  },

  /**
   * Utilizacao de infraestrutura
   */
  utilization: {
    detect_aws: true,
    detect_docker: true,
    detect_kubernetes: true
  }
};

