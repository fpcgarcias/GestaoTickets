/**
 * Configuração OpenTelemetry para instrumentação automática
 * Monitora Express, PostgreSQL, HTTP e File System
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

// Só configurar em produção
if (process.env.NODE_ENV === 'production') {
  console.log('🔧 Configurando OpenTelemetry...');

  // Configurar exportador de traces para New Relic
  const traceExporter = new OTLPTraceExporter({
    url: 'https://otlp.nr-data.net/v1/traces',
    headers: {
      'api-key': process.env.NEW_RELIC_LICENSE_KEY || '',
    },
  });

  // Configurar exportador de métricas para New Relic
  const metricExporter = new OTLPMetricExporter({
    url: 'https://otlp.nr-data.net/v1/metrics',
    headers: {
      'api-key': process.env.NEW_RELIC_LICENSE_KEY || '',
    },
  });

  // Configurar SDK do Node.js
  const sdk = new NodeSDK({
    serviceName: process.env.NEW_RELIC_APP_NAME || 'GestaoTickets',
    serviceVersion: '1.0.0',
    
    // Instrumentações automáticas
    instrumentations: [
      getNodeAutoInstrumentations({
        // Configurações específicas
        '@opentelemetry/instrumentation-express': {
          // Monitorar todas as rotas Express
          enabled: true,
        },
        '@opentelemetry/instrumentation-http': {
          // Monitorar requests HTTP (APIs externas)
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          // Monitorar queries PostgreSQL
          enabled: true,
        },
        '@opentelemetry/instrumentation-fs': {
          // Monitorar operações de arquivo (uploads)
          enabled: true,
        },
      }),
    ],
    
    // Exportador de traces
    traceExporter,
    
    // Leitor de métricas
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000, // Exportar a cada 10 segundos
    }),
  });

  // Inicializar SDK
  sdk.start();
  
  console.log('✅ OpenTelemetry configurado com sucesso!');
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('🔧 OpenTelemetry finalizado'))
      .catch((error) => console.error('❌ Erro ao finalizar OpenTelemetry:', error))
      .finally(() => process.exit(0));
  });
} else {
  console.log('⚠️  OpenTelemetry desabilitado (NODE_ENV não é production)');
}

export {}; // Para tornar este arquivo um módulo ES
