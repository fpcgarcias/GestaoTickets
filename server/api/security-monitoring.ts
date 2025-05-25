import { Request, Response } from 'express';
import { db } from '../db';
import { tickets, users, ticketStatusHistory } from '@shared/schema';
import { sql, desc, and, gte } from 'drizzle-orm';

// Armazenamento temporário de eventos de segurança (em produção, usar Redis/banco)
const securityEvents: Array<{
  timestamp: Date;
  ip: string;
  userAgent: string;
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}> = [];

/**
 * Registra evento de segurança
 */
export function logSecurityEvent(
  ip: string,
  userAgent: string,
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any = {}
) {
  securityEvents.push({
    timestamp: new Date(),
    ip,
    userAgent,
    event,
    severity,
    details
  });

  // Manter apenas os últimos 1000 eventos em memória
  if (securityEvents.length > 1000) {
    securityEvents.shift();
  }

  // Log no console para eventos críticos
  if (severity === 'critical' || severity === 'high') {
    console.warn(`🚨 EVENTO DE SEGURANÇA [${severity.toUpperCase()}]:`, {
      event,
      ip,
      timestamp: new Date().toISOString(),
      details
    });
  }
}

/**
 * Endpoint: Relatório de segurança (apenas admin)
 */
export async function getSecurityReport(req: Request, res: Response) {
  try {
    const { hours = 24 } = req.query;
    const hoursNum = parseInt(hours as string) || 24;
    const since = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

    // Filtrar eventos recentes
    const recentEvents = securityEvents
      .filter(event => event.timestamp >= since)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Estatísticas
    const stats = {
      total: recentEvents.length,
      critical: recentEvents.filter(e => e.severity === 'critical').length,
      high: recentEvents.filter(e => e.severity === 'high').length,
      medium: recentEvents.filter(e => e.severity === 'medium').length,
      low: recentEvents.filter(e => e.severity === 'low').length,
      uniqueIPs: new Set(recentEvents.map(e => e.ip)).size
    };

    // IPs mais ativos
    const ipCount = recentEvents.reduce((acc, event) => {
      acc[event.ip] = (acc[event.ip] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topIPs = Object.entries(ipCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    res.json({
      timeRange: `${hoursNum} horas`,
      stats,
      topIPs,
      recentEvents: recentEvents.slice(0, 50), // Últimos 50 eventos
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de segurança:', error);
    res.status(500).json({ 
      message: 'Erro ao gerar relatório de segurança',
      error: String(error)
    });
  }
}

/**
 * Endpoint: Estatísticas do sistema (apenas admin)
 */
export async function getSystemStats(req: Request, res: Response) {
  try {
    const [
      totalUsers,
      totalTickets,
      recentTickets,
      activeUsers
    ] = await Promise.all([
      // Total de usuários
      db.select({ count: sql<number>`count(*)` }).from(users),
      
      // Total de tickets
      db.select({ count: sql<number>`count(*)` }).from(tickets),
      
      // Tickets criados nas últimas 24h
      db.select({ count: sql<number>`count(*)` })
        .from(tickets)
        .where(gte(tickets.created_at, new Date(Date.now() - 24 * 60 * 60 * 1000))),
      
      // Usuários ativos (logaram nas últimas 7 dias)
      db.select({ count: sql<number>`count(distinct user_id)` })
        .from(ticketStatusHistory)
        .where(gte(ticketStatusHistory.created_at, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
    ]);

    res.json({
      users: {
        total: totalUsers[0]?.count || 0,
        active: activeUsers[0]?.count || 0
      },
      tickets: {
        total: totalTickets[0]?.count || 0,
        last24h: recentTickets[0]?.count || 0
      },
      security: {
        eventsLast24h: securityEvents.filter(
          e => e.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length,
        criticalEvents: securityEvents.filter(
          e => e.severity === 'critical' && 
               e.timestamp >= new Date(Date.now() - 24 * 60 * 60 * 1000)
        ).length
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas do sistema:', error);
    res.status(500).json({ 
      message: 'Erro ao obter estatísticas do sistema',
      error: String(error)
    });
  }
}

/**
 * Endpoint: Health check com informações de segurança
 */
export async function healthCheck(req: Request, res: Response) {
  try {
    const checks = {
      database: false,
      security: false,
      timestamp: new Date().toISOString()
    };

    // Verificar conexão com banco
    try {
      await db.select({ count: sql<number>`1` }).from(users).limit(1);
      checks.database = true;
    } catch (error) {
      console.error('Health check - erro no banco:', error);
    }

    // Verificar se há muitos eventos críticos recentes
    const criticalEvents = securityEvents.filter(
      e => e.severity === 'critical' && 
           e.timestamp >= new Date(Date.now() - 60 * 60 * 1000) // última hora
    );
    
    checks.security = criticalEvents.length < 10; // Menos de 10 eventos críticos na última hora

    const status = checks.database && checks.security ? 200 : 503;
    
    res.status(status).json({
      status: status === 200 ? 'healthy' : 'unhealthy',
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    });

  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(503).json({ 
      status: 'error',
      message: 'Erro no health check',
      error: String(error)
    });
  }
}

/**
 * Endpoint: Limpar logs de segurança (apenas admin)
 */
export async function clearSecurityLogs(req: Request, res: Response) {
  try {
    const { olderThan = 24 } = req.body;
    const cutoff = new Date(Date.now() - olderThan * 60 * 60 * 1000);
    
    const beforeCount = securityEvents.length;
    
    // Remover eventos antigos
    for (let i = securityEvents.length - 1; i >= 0; i--) {
      if (securityEvents[i].timestamp < cutoff) {
        securityEvents.splice(i, 1);
      }
    }
    
    const afterCount = securityEvents.length;
    const removed = beforeCount - afterCount;

    res.json({
      message: `${removed} eventos de segurança foram removidos`,
      before: beforeCount,
      after: afterCount,
      cutoff: cutoff.toISOString()
    });

  } catch (error) {
    console.error('Erro ao limpar logs de segurança:', error);
    res.status(500).json({ 
      message: 'Erro ao limpar logs de segurança',
      error: String(error)
    });
  }
}

// Registrar eventos de segurança automaticamente
export { securityEvents }; 