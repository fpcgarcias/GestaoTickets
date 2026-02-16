import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

// Extend Express Request type to include user (module augmentation)
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      username: string;
      role: string;
    };
  }
}

/**
 * Middleware para validar arquivos Excel antes do processamento
 * Mitigação para vulnerabilidades CVE xlsx: GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9
 */
export const validateExcelFile = (req: Request, res: Response, next: NextFunction) => {
  const file = req.file;
  
  if (!file) {
    return next();
  }
  
  // Validar tamanho (máximo 10MB para prevenir DoS)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    logger.warn('Tentativa de upload de arquivo muito grande', {
      filename: file.originalname,
      size: file.size,
      maxSize,
      user: req.user?.username || 'unknown',
      ip: req.ip
    });
    
    return res.status(400).json({ 
      error: 'Arquivo muito grande. O tamanho máximo permitido é 10MB.' 
    });
  }
  
  // Validar tipo MIME
  const allowedTypes = [
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'text/csv' // .csv
  ];
  
  if (!allowedTypes.includes(file.mimetype)) {
    logger.warn('Tentativa de upload de tipo de arquivo inválido', {
      filename: file.originalname,
      mimetype: file.mimetype,
      allowedTypes,
      user: req.user?.username || 'unknown',
      ip: req.ip
    });
    
    return res.status(400).json({ 
      error: 'Tipo de arquivo inválido. Apenas arquivos Excel (.xls, .xlsx) e CSV são permitidos.' 
    });
  }
  
  // Validar extensão do arquivo (double-check)
  const allowedExtensions = ['.xls', '.xlsx', '.csv'];
  const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    logger.warn('Tentativa de upload com extensão inválida', {
      filename: file.originalname,
      extension: fileExtension,
      allowedExtensions,
      user: req.user?.username || 'unknown',
      ip: req.ip
    });
    
    return res.status(400).json({ 
      error: 'Extensão de arquivo inválida. Apenas .xls, .xlsx e .csv são permitidos.' 
    });
  }
  
  // Log de sucesso
  logger.info('Arquivo validado com sucesso', {
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    user: req.user?.username || 'unknown'
  });
  
  next();
};

/**
 * Wrapper para adicionar timeout em operações de processamento
 * Previne DoS via arquivos Excel complexos que causam processamento infinito
 */
export const withTimeout = async <T>(
  promise: Promise<T>, 
  timeoutMs: number = 30000,
  errorMessage: string = 'Timeout no processamento do arquivo'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

/**
 * Middleware genérico para validar múltiplos arquivos
 */
export const validateMultipleFiles = (maxFiles: number = 5) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[] | undefined;
    
    if (!files || files.length === 0) {
      return next();
    }
    
    if (files.length > maxFiles) {
      logger.warn('Tentativa de upload de muitos arquivos', {
        fileCount: files.length,
        maxFiles,
        user: req.user?.username || 'unknown',
        ip: req.ip
      });
      
      return res.status(400).json({ 
        error: `Número máximo de arquivos excedido. Máximo permitido: ${maxFiles}` 
      });
    }
    
    // Validar cada arquivo individualmente
    for (const file of files) {
      req.file = file;
      const validationResult = validateExcelFile(req, res, () => {});
      if (validationResult) {
        return validationResult;
      }
    }
    
    next();
  };
};

/**
 * Interface para opções de validação customizadas
 */
export interface FileValidationOptions {
  maxSize?: number; // em bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

/**
 * Factory para criar middleware de validação com opções customizadas
 */
export const createFileValidator = (options: FileValidationOptions = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB padrão
    allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    allowedExtensions = ['.xls', '.xlsx', '.csv']
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    
    if (!file) {
      return next();
    }
    
    // Validar tamanho
    if (file.size > maxSize) {
      logger.warn('Arquivo muito grande', {
        filename: file.originalname,
        size: file.size,
        maxSize,
        user: req.user?.username || 'unknown'
      });
      
      return res.status(400).json({ 
        error: `Arquivo muito grande. Tamanho máximo: ${Math.round(maxSize / 1024 / 1024)}MB` 
      });
    }
    
    // Validar tipo MIME
    if (!allowedTypes.includes(file.mimetype)) {
      logger.warn('Tipo de arquivo inválido', {
        filename: file.originalname,
        mimetype: file.mimetype,
        user: req.user?.username || 'unknown'
      });
      
      return res.status(400).json({ 
        error: 'Tipo de arquivo não permitido.' 
      });
    }
    
    // Validar extensão
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      logger.warn('Extensão inválida', {
        filename: file.originalname,
        extension: fileExtension,
        user: req.user?.username || 'unknown'
      });
      
      return res.status(400).json({ 
        error: 'Extensão de arquivo não permitida.' 
      });
    }
    
    next();
  };
};

