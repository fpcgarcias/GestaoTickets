import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import * as os from 'os';

// Interface para métricas de performance
interface PerformanceMetrics {
  method: string;
  path: string;
  duration: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

// Armazenar métricas em memória (em produção, usar Redis ou banco)
const performanceMetrics: PerformanceMetrics[] = [];
const MAX_METRICS_IN_MEMORY = 1000;

// Thresholds de performance
const SLOW_REQUEST_THRESHOLD = 1000; // 1 segundo
const VERY_SLOW_REQUEST_THRESHOLD = 3000; // 3 segundos

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  // Capturar quando a resposta termina
  res.on('finish', () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    const metrics: PerformanceMetrics = {
      method: req.method,
      path: req.path,
      duration: Math.round(duration),
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date()
    };
    
    // Adicionar às métricas em memória
    performanceMetrics.push(metrics);
    
    // Manter apenas as últimas métricas
    if (performanceMetrics.length > MAX_METRICS_IN_MEMORY) {
      performanceMetrics.shift();
    }
    
    // Log apenas requisições lentas em produção
    if (process.env.NODE_ENV === 'production') {
      if (duration > VERY_SLOW_REQUEST_THRESHOLD) {
        console.error(`🐌 VERY SLOW REQUEST: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
      } else if (duration > SLOW_REQUEST_THRESHOLD) {
        console.warn(`⚠️ SLOW REQUEST: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
      }
    } else {
      // Em desenvolvimento, log todas as requisições da API
      if (req.path.startsWith('/api')) {
        const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
        console.log(`📊 ${req.method} ${req.path} - ${duration.toFixed(2)}ms - Memory: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
      }
    }
  });
  
  next();
};

// Função para obter estatísticas de performance
export const getPerformanceStats = () => {
  if (performanceMetrics.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      verySlowRequests: 0,
      errorRate: 0
    };
  }
  
  const totalRequests = performanceMetrics.length;
  const totalDuration = performanceMetrics.reduce((sum, metric) => sum + metric.duration, 0);
  const averageResponseTime = totalDuration / totalRequests;
  
  const slowRequests = performanceMetrics.filter(m => m.duration > SLOW_REQUEST_THRESHOLD).length;
  const verySlowRequests = performanceMetrics.filter(m => m.duration > VERY_SLOW_REQUEST_THRESHOLD).length;
  const errorRequests = performanceMetrics.filter(m => m.statusCode >= 400).length;
  const errorRate = (errorRequests / totalRequests) * 100;
  
  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime),
    slowRequests,
    verySlowRequests,
    errorRate: Math.round(errorRate * 100) / 100,
    slowRequestsPercentage: Math.round((slowRequests / totalRequests) * 100 * 100) / 100,
    verySlowRequestsPercentage: Math.round((verySlowRequests / totalRequests) * 100 * 100) / 100
  };
};

// Função para obter as requisições mais lentas
export const getSlowestRequests = (limit = 10) => {
  return performanceMetrics
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit)
    .map(metric => ({
      method: metric.method,
      path: metric.path,
      duration: metric.duration,
      statusCode: metric.statusCode,
      timestamp: metric.timestamp
    }));
};

// Função para limpar métricas antigas
export const clearOldMetrics = () => {
  performanceMetrics.length = 0;
  console.log('📊 Métricas de performance limpas');
};

// Função para agrupar erros por endpoint, método e status
const getErrorDetails = (limit = 10) => {
  const errorMap = new Map<string, { count: number; method: string; path: string; statusCode: number }>();
  for (const metric of performanceMetrics) {
    if (metric.statusCode >= 400) {
      const key = `${metric.method} ${metric.path} ${metric.statusCode}`;
      if (!errorMap.has(key)) {
        errorMap.set(key, { count: 0, method: metric.method, path: metric.path, statusCode: metric.statusCode });
      }
      errorMap.get(key)!.count++;
    }
  }
  return Array.from(errorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// Função para distribuição de status codes
const getStatusCodeDistribution = () => {
  const dist: Record<string, number> = {};
  for (const metric of performanceMetrics) {
    const code = `${metric.statusCode}`;
    dist[code] = (dist[code] || 0) + 1;
  }
  return dist;
};

// Função para top endpoints por volume
const getTopEndpoints = (limit = 10) => {
  const endpointMap = new Map<string, { count: number; method: string; path: string }>();
  for (const metric of performanceMetrics) {
    const key = `${metric.method} ${metric.path}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, { count: 0, method: metric.method, path: metric.path });
    }
    endpointMap.get(key)!.count++;
  }
  return Array.from(endpointMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

// Função para top endpoints por tempo médio de resposta
const getTopEndpointsByAvgTime = (limit = 10) => {
  const endpointMap = new Map<string, { totalTime: number; count: number; method: string; path: string }>();
  for (const metric of performanceMetrics) {
    const key = `${metric.method} ${metric.path}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, { totalTime: 0, count: 0, method: metric.method, path: metric.path });
    }
    const entry = endpointMap.get(key)!;
    entry.totalTime += metric.duration;
    entry.count++;
  }
  return Array.from(endpointMap.values())
    .map(e => ({
      method: e.method,
      path: e.path,
      avgDuration: Math.round(e.totalTime / e.count),
      count: e.count
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, limit);
};

// Função para percentual de erros por endpoint
const getErrorRateByEndpoint = (limit = 10, minReqs = 5) => {
  const endpointMap = new Map<string, { errors: number; total: number; method: string; path: string }>();
  for (const metric of performanceMetrics) {
    const key = `${metric.method} ${metric.path}`;
    if (!endpointMap.has(key)) {
      endpointMap.set(key, { errors: 0, total: 0, method: metric.method, path: metric.path });
    }
    const entry = endpointMap.get(key)!;
    entry.total++;
    if (metric.statusCode >= 400) entry.errors++;
  }
  return Array.from(endpointMap.values())
    .filter(e => e.total >= minReqs)
    .map(e => ({
      method: e.method,
      path: e.path,
      errorRate: Math.round((e.errors / e.total) * 10000) / 100,
      total: e.total,
      errors: e.errors
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, limit);
};

// Middleware para endpoints de métricas (apenas admin)
export const performanceStatsHandler = (req: Request, res: Response) => {
  const stats = getPerformanceStats();
  const slowestRequests = getSlowestRequests();
  const errorDetails = getErrorDetails(); // Detalhamento dos erros
  const statusCodeDistribution = getStatusCodeDistribution(); // Distribuição de status codes
  const topEndpoints = getTopEndpoints(); // Top endpoints por volume
  const topEndpointsByAvgTime = getTopEndpointsByAvgTime(); // Top endpoints por tempo médio
  const errorRateByEndpoint = getErrorRateByEndpoint(); // Percentual de erro por endpoint

  // Cálculo de uso médio de CPU
  let cpuUsage = undefined;
  if (typeof process.cpuUsage === 'function') {
    const usage = process.cpuUsage();
    // user + system em microssegundos, dividir por 1_000_000 para segundos
    const totalMicros = usage.user + usage.system;
    const uptime = process.uptime();
    if (uptime > 0) {
      cpuUsage = totalMicros / 1_000_000 / uptime / os.cpus().length;
    }
  }

  res.json({
    stats,
    slowestRequests,
    errorDetails, // Novo: detalhamento dos erros
    statusCodeDistribution, // Novo: distribuição de status codes
    topEndpoints, // Novo: top endpoints por volume
    topEndpointsByAvgTime, // Novo: top endpoints por tempo médio
    errorRateByEndpoint, // Novo: percentual de erro por endpoint
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      cpuUsage
    }
  });
}; 