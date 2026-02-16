import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { performanceLogger } from '../services/logger.js';

// Interface para métricas de performance
interface PerformanceMetrics {
  method: string;
  path: string;
  duration: number;
  statusCode: number;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
}

// Thresholds de performance
const SLOW_REQUEST_THRESHOLD = 1000; // 1 segundo
const VERY_SLOW_REQUEST_THRESHOLD = 3000; // 3 segundos

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();
  
  // Capturar quando a resposta termina
  res.on('finish', () => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage();
    
    // Persistir no arquivo de log usando Winston (única fonte de verdade)
    performanceLogger.info('Performance metric', {
      operation: `${req.method} ${req.path}`,
      duration: Math.round(duration),
      statusCode: res.statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      memoryUsage: {
        heapUsed: endMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external,
        rss: endMemory.rss
      },
      cpuUsage: {
        user: endCpu.user - startCpu.user,
        system: endCpu.system - startCpu.system
      },
      // Adicionar metadados para facilitar análise
      isSlow: duration > SLOW_REQUEST_THRESHOLD,
      isVerySlow: duration > VERY_SLOW_REQUEST_THRESHOLD,
      isError: res.statusCode >= 400,
      memoryDiff: endMemory.heapUsed - startMemory.heapUsed
    });
    
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

// Função para carregar logs de performance do arquivo
export const loadPerformanceLogsFromFile = async (limit = 1000, startDate?: Date, endDate?: Date) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    const performanceLogPath = path.join(logsDir, 'performance.log');
    
    if (!fs.existsSync(performanceLogPath)) {
      return [];
    }
    
    const content = fs.readFileSync(performanceLogPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const logs: PerformanceMetrics[] = [];
    
    for (const line of lines.slice(-limit)) { // Pegar as últimas linhas
      try {
        const logEntry = JSON.parse(line);
        
        // Extrair dados do log do Winston
        if (logEntry.message === 'Performance metric' && logEntry.operation) {
          const timestamp = new Date(logEntry.timestamp || logEntry.timestamp);
          
          // Aplicar filtros de data se fornecidos
          if (startDate && timestamp < startDate) continue;
          if (endDate && timestamp > endDate) continue;
          
          logs.push({
            method: logEntry.operation.split(' ')[0] || 'UNKNOWN',
            path: logEntry.operation.split(' ').slice(1).join(' ') || '/',
            duration: logEntry.duration || 0,
            statusCode: logEntry.statusCode || 200,
            userAgent: logEntry.userAgent,
            ip: logEntry.ip,
            timestamp: timestamp,
            memoryUsage: logEntry.memoryUsage,
            cpuUsage: logEntry.cpuUsage
          });
        }
      } catch (_parseError) {
        // Ignorar linhas que não são JSON válido
        continue;
      }
    }
    
    return logs.reverse(); // Retornar em ordem cronológica
  } catch (error) {
    console.error('Erro ao carregar logs de performance do arquivo:', error);
    return [];
  }
};

// Função para obter estatísticas de performance do arquivo
export const getPerformanceStats = async (days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  
  if (logs.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      slowRequests: 0,
      verySlowRequests: 0,
      errorRate: 0,
      dataSource: 'file',
      period: `${days} days`
    };
  }
  
  const totalRequests = logs.length;
  const totalDuration = logs.reduce((sum, metric) => sum + metric.duration, 0);
  const averageResponseTime = totalDuration / totalRequests;
  
  const slowRequests = logs.filter(m => m.duration > SLOW_REQUEST_THRESHOLD).length;
  const verySlowRequests = logs.filter(m => m.duration > VERY_SLOW_REQUEST_THRESHOLD).length;
  const errorRequests = logs.filter(m => m.statusCode >= 400).length;
  const errorRate = (errorRequests / totalRequests) * 100;
  
  return {
    totalRequests,
    averageResponseTime: Math.round(averageResponseTime),
    slowRequests,
    verySlowRequests,
    errorRate: Math.round(errorRate * 100) / 100,
    slowRequestsPercentage: Math.round((slowRequests / totalRequests) * 100 * 100) / 100,
    verySlowRequestsPercentage: Math.round((verySlowRequests / totalRequests) * 100 * 100) / 100,
    dataSource: 'file',
    period: `${days} days`
  };
};

// Função para obter as requisições mais lentas
export const getSlowestRequests = async (limit = 10, days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  
  return logs
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

// Função para agrupar erros por endpoint, método e status
export const getErrorDetails = async (limit = 10, days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  const errorMap = new Map<string, { count: number; method: string; path: string; statusCode: number }>();
  
  for (const metric of logs) {
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
export const getStatusCodeDistribution = async (days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  const dist: Record<string, number> = {};
  
  for (const metric of logs) {
    const code = `${metric.statusCode}`;
    dist[code] = (dist[code] || 0) + 1;
  }
  
  return dist;
};

// Função para top endpoints por volume
export const getTopEndpoints = async (limit = 10, days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  const endpointMap = new Map<string, { count: number; method: string; path: string }>();
  
  for (const metric of logs) {
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
export const getTopEndpointsByAvgTime = async (limit = 10, days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  const endpointMap = new Map<string, { totalTime: number; count: number; method: string; path: string }>();
  
  for (const metric of logs) {
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
export const getErrorRateByEndpoint = async (limit = 10, minReqs = 5, days = 7) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const logs = await loadPerformanceLogsFromFile(10000, startDate, endDate);
  const endpointMap = new Map<string, { errors: number; total: number; method: string; path: string }>();
  
  for (const metric of logs) {
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
export const performanceStatsHandler = async (req: Request, res: Response) => {
  const { days = '7' } = req.query;
  const daysNum = parseInt(days.toString()) || 7;
  
  try {
    // Obter todas as estatísticas do arquivo
    const stats = await getPerformanceStats(daysNum);
    const slowestRequests = await getSlowestRequests(10, daysNum);
    const errorDetails = await getErrorDetails(10, daysNum);
    const statusCodeDistribution = await getStatusCodeDistribution(daysNum);
    const topEndpoints = await getTopEndpoints(10, daysNum);
    const topEndpointsByAvgTime = await getTopEndpointsByAvgTime(10, daysNum);
    const errorRateByEndpoint = await getErrorRateByEndpoint(10, 5, daysNum);

    // Cálculo de uso médio de CPU
    let cpuUsage = undefined;
    if (typeof process.cpuUsage === 'function') {
      const usage = process.cpuUsage();
      const totalMicros = usage.user + usage.system;
      const uptime = process.uptime();
      if (uptime > 0) {
        cpuUsage = totalMicros / 1_000_000 / uptime / os.cpus().length;
      }
    }

    res.json({
      stats,
      slowestRequests,
      errorDetails,
      statusCodeDistribution,
      topEndpoints,
      topEndpointsByAvgTime,
      errorRateByEndpoint,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        cpuUsage
      },
      // Informações sobre persistência
      persistence: {
        dataSource: 'file',
        logFileEnabled: true,
        logRotation: 'daily',
        logRetention: '14 days',
        period: `${daysNum} days`
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas de performance:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível carregar as estatísticas de performance'
    });
  }
}; 