/**
 * Métricas customizadas TÉCNICAS para monitoramento do sistema
 * FOCO: Performance, erros, infraestrutura - NÃO métricas de negócio
 */

import { metrics } from '@opentelemetry/api';

// Só criar métricas em produção
let systemMetrics: any = null;

if (process.env.NODE_ENV === 'production') {
  console.log('📊 Configurando métricas técnicas do sistema...');

  // Obter meter para criar métricas
  const meter = metrics.getMeter('gestao-tickets-system', '1.0.0');

  // Métricas TÉCNICAS do sistema
  systemMetrics = {
    // Contadores de ERROS
    apiErrors: meter.createCounter('api_errors_total', {
      description: 'Total de erros nas APIs por endpoint',
    }),

    databaseErrors: meter.createCounter('database_errors_total', {
      description: 'Total de erros de banco de dados',
    }),

    httpErrors: meter.createCounter('http_errors_total', {
      description: 'Total de erros HTTP por status code',
    }),

    // Histogramas de PERFORMANCE
    apiResponseTime: meter.createHistogram('api_response_time_ms', {
      description: 'Tempo de resposta das APIs em millisegundos',
    }),

    databaseQueryTime: meter.createHistogram('database_query_time_ms', {
      description: 'Tempo de execução das queries em millisegundos',
    }),

    // Gauges de INFRAESTRUTURA
    memoryUsage: meter.createUpDownCounter('memory_usage_bytes', {
      description: 'Uso de memória em bytes',
    }),

    databaseConnections: meter.createUpDownCounter('database_connections_active', {
      description: 'Número de conexões ativas com o banco',
    }),

    websocketConnections: meter.createUpDownCounter('websocket_connections_active', {
      description: 'Número de conexões WebSocket ativas',
    }),
  };

  console.log('✅ Métricas técnicas configuradas!');
}

// Funções helper TÉCNICAS para usar as métricas
export const recordApiError = (endpoint: string, statusCode: number, errorType: string) => {
  if (systemMetrics) {
    systemMetrics.apiErrors.add(1, { endpoint, error_type: errorType });
    systemMetrics.httpErrors.add(1, { status_code: statusCode.toString() });
  }
};

export const recordDatabaseError = (operation: string, errorType: string) => {
  if (systemMetrics) {
    systemMetrics.databaseErrors.add(1, { operation, error_type: errorType });
  }
};

export const recordApiResponseTime = (endpoint: string, timeInMs: number, statusCode: number) => {
  if (systemMetrics) {
    systemMetrics.apiResponseTime.record(timeInMs, { 
      endpoint, 
      status_code: statusCode.toString() 
    });
  }
};

export const recordDatabaseQueryTime = (queryType: string, timeInMs: number) => {
  if (systemMetrics) {
    systemMetrics.databaseQueryTime.record(timeInMs, { query_type: queryType });
  }
};

export const updateMemoryUsage = () => {
  if (systemMetrics) {
    const memUsage = process.memoryUsage();
    systemMetrics.memoryUsage.add(memUsage.heapUsed, { type: 'heap_used' });
    systemMetrics.memoryUsage.add(memUsage.rss, { type: 'rss' });
  }
};

export const addWebSocketConnection = () => {
  if (systemMetrics) {
    systemMetrics.websocketConnections.add(1);
  }
};

export const removeWebSocketConnection = () => {
  if (systemMetrics) {
    systemMetrics.websocketConnections.add(-1);
  }
};

export const updateDatabaseConnections = (activeCount: number) => {
  if (systemMetrics) {
    systemMetrics.databaseConnections.add(activeCount);
  }
};

export default systemMetrics;
