import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import { logSecurityEvent } from '../api/security-monitoring';

// Estender Request para incluir file do multer
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}

// === VALIDAÇÃO DE SCHEMAS ===
export const validateSchema = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      logSecurityEvent(
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        'validation_failed',
        'medium',
        { 
          endpoint: req.path,
          errors: error.details.map(d => d.message),
          payload: req.body
        }
      );
      return res.status(400).json({
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// === SCHEMAS DE VALIDAÇÃO ===
export const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).max(128).required()
});

export const ticketSchema = Joi.object({
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(10).max(5000).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  customer_email: Joi.string().email().required()
});

// === SANITIZAÇÃO DE HTML ===
export const sanitizeHtml = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return xss(value);
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  
  next();
};

// === RATE LIMITERS ESPECÍFICOS ===
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'rate_limit_auth',
      'high',
      { 
        endpoint: req.path,
        attempts: 5
      }
    );
    
    res.status(429).json({
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: 15 * 60
    });
  }
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de requisições excedido',
    retryAfter: '15 minutos',
    code: 'RATE_LIMIT_API'
  },
  handler: (req: Request, res: Response) => {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'rate_limit_api',
      'medium',
      { 
        endpoint: req.path,
        limit: 1000
      }
    );
    
    res.status(429).json({
      message: 'Limite de requisições excedido. Tente novamente em 15 minutos.',
      retryAfter: 15 * 60
    });
  }
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 uploads por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de uploads excedido',
    retryAfter: '1 hora',
    code: 'RATE_LIMIT_UPLOAD'
  },
  handler: (req: Request, res: Response) => {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'rate_limit_upload',
      'medium',
      { 
        endpoint: req.path,
        limit: 20
      }
    );
    
    res.status(429).json({
      message: 'Limite de uploads excedido. Tente novamente em 1 hora.',
      retryAfter: 60 * 60
    });
  }
});

// === VALIDAÇÃO DE ARQUIVO ===
export const validateFileUpload = (req: RequestWithFile, res: Response, next: NextFunction) => {
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado' });
  }

  // Validar tamanho (10MB máximo)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'file_size_exceeded',
      'medium',
      { 
        filename: file.originalname,
        size: file.size,
        maxSize
      }
    );
    return res.status(400).json({ 
      message: 'Arquivo muito grande. Tamanho máximo: 10MB' 
    });
  }

  // Validar tipo MIME
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/x-rar-compressed'
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'invalid_file_type',
      'medium',
      { 
        filename: file.originalname,
        mimetype: file.mimetype,
        allowedTypes
      }
    );
    return res.status(400).json({ 
      message: 'Tipo de arquivo não permitido' 
    });
  }

  next();
};

// === MIDDLEWARE DE LOG DE SEGURANÇA ===
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log de requisições suspeitas
  const suspicious = checkSuspiciousRequest(req);
  if (suspicious.isSuspicious) {
    logSecurityEvent(
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown',
      'suspicious_request',
      suspicious.severity,
      {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        reasons: suspicious.reasons
      }
    );
  }

  // Interceptar resposta para logar erros
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    // Log de respostas de erro
    if (res.statusCode >= 400) {
      logSecurityEvent(
        req.ip || 'unknown',
        req.get('User-Agent') || 'unknown',
        `http_error_${res.statusCode}`,
        res.statusCode >= 500 ? 'high' : 'medium',
        {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          response: body
        }
      );
    }
    
    return originalSend.call(this, body);
  };

  next();
};

// === DETECÇÃO DE PADRÕES SUSPEITOS ===

function checkSuspiciousRequest(req: Request): { 
  isSuspicious: boolean; 
  severity: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
} {
  const reasons: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  const checkSuspicious = (value: string): boolean => {
    const patterns: RegExp[] = [
      /(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\s+)/i, // SQL Injection
      /<script[\s\S]*?>[\s\S]*?<\/script>/i, // XSS básico
      /javascript:/i, // JavaScript injection
      /\.\.\/.*\.\.\/.*\.\.\//i, // Path traversal
      /(\b(eval|setTimeout|setInterval)\s*\()/i, // Code injection
      /(\/etc\/passwd|\/windows\/system32)/i, // File inclusion
      /(\b(curl|wget|nc|netcat|telnet|ssh)\b)/i, // Command injection
    ];
    
    return patterns.some(pattern => pattern.test(value));
  };

  // Verificar URL
  if (checkSuspicious(req.url)) {
    reasons.push('URL suspeita');
    severity = 'high';
  }

  // Verificar parâmetros de query
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string' && checkSuspicious(value)) {
      reasons.push(`Query parameter suspeito: ${key}`);
      severity = severity === 'low' ? 'medium' : severity;
    }
  }

  // Verificar corpo da requisição
  if (req.body) {
    const bodyStr = JSON.stringify(req.body);
    if (checkSuspicious(bodyStr)) {
      reasons.push('Payload suspeito no corpo da requisição');
      severity = severity === 'low' ? 'high' : severity;
    }
  }

  // Verificar headers suspeitos
  const userAgent = req.get('User-Agent') || '';
  const suspiciousAgents = [
    'sqlmap', 'nmap', 'nikto', 'masscan', 'zap', 'burp',
    'w3af', 'metasploit', 'nessus', 'openvas'
  ];
  
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    reasons.push('User-Agent suspeito');
    severity = 'critical';
  }

  // Verificar rate limiting manual (muitas requests muito rápidas)
  const xForwardedFor = req.get('X-Forwarded-For');
  if (xForwardedFor && xForwardedFor.split(',').length > 5) {
    reasons.push('Múltiplos forwards suspeitos');
    severity = severity === 'low' ? 'medium' : severity;
  }

  return {
    isSuspicious: reasons.length > 0,
    severity,
    reasons
  };
} 