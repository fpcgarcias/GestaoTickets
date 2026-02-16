import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

// Configurar formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Configurar transports baseado no ambiente
const transports: winston.transport[] = [];

// Console transport (apenas em desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  );
}

// File transports (sempre)
transports.push(
  // Log de erros
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.json(),
      winston.format.timestamp()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  
  // Log combinado
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.json(),
      winston.format.timestamp()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// Criar logger principal
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports,
  // Não sair do processo em caso de erro
  exitOnError: false
});

// Logger específico para performance
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Usar DailyRotateFile para rotação automática
    new winston.transports.DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m', // 10MB por arquivo
      maxFiles: '14d', // Manter 14 dias de logs
      zippedArchive: true, // Comprimir arquivos antigos
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json()
      )
    }),
    // Manter um arquivo performance.log sempre atual
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'performance.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 1, // Apenas 1 arquivo
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.json()
      )
    })
  ]
});

// Logger específico para segurança
export const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'security.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Função helper para logging de performance
export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  performanceLogger.info('Performance metric', {
    operation,
    duration,
    ...metadata
  });
};

// Função helper para logging de segurança
export const logSecurity = (event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: any) => {
  securityLogger.warn('Security event', {
    event,
    severity,
    ...metadata
  });
};

// Função helper para logging completo de erros do sistema de notificações
export const logNotificationError = (
  operation: string,
  error: any,
  severity: 'info' | 'warning' | 'error' | 'critical' = 'error',
  context?: {
    userId?: number;
    notificationId?: number;
    ticketId?: number;
    endpoint?: string;
    [key: string]: any;
  }
) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stackTrace = error instanceof Error ? error.stack : undefined;
  
  const logData = {
    operation,
    error: errorMessage,
    stack: stackTrace,
    severity,
    timestamp: new Date().toISOString(),
    ...context
  };

  // Log baseado na severidade
  switch (severity) {
    case 'critical':
      logger.error(`[CRÍTICO] ${operation}: ${errorMessage}`, logData);
      break;
    case 'error':
      logger.error(`[ERRO] ${operation}: ${errorMessage}`, logData);
      break;
    case 'warning':
      logger.warn(`[AVISO] ${operation}: ${errorMessage}`, logData);
      break;
    case 'info':
      logger.info(`[INFO] ${operation}: ${errorMessage}`, logData);
      break;
  }

  // Para erros críticos, também registrar no log de segurança
  if (severity === 'critical') {
    logSecurity(`Critical notification system error: ${operation}`, 'critical', logData);
  }
};

// Middleware para capturar logs não tratados
if (process.env.NODE_ENV === 'production') {
  // Capturar console.log em produção
  const _originalConsoleLog = console.log;
  const _originalConsoleError = console.error;
  const _originalConsoleWarn = console.warn;
  
  console.log = (...args: any[]) => {
    logger.info(args.join(' '));
  };
  
  console.error = (...args: any[]) => {
    logger.error(args.join(' '));
  };
  
  console.warn = (...args: any[]) => {
    logger.warn(args.join(' '));
  };
}

// Criar diretório de logs se não existir
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger; 