import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

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

// Middleware para endpoints de métricas (apenas admin)
export const performanceStatsHandler = (req: Request, res: Response) => {
  const stats = getPerformanceStats();
  const slowestRequests = getSlowestRequests();
  
  res.json({
    stats,
    slowestRequests,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage()
    }
  });
}; 