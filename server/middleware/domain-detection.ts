import { Request, Response, NextFunction } from 'express';

// Domínios que devem usar autenticação via Active Directory
const AD_ENABLED_DOMAINS = [
  'suporte.vixbrasil.com',
  'sistema.vixbrasil.com',
  'vixbrasil.com'
];

/**
 * Interface estendida do Request para incluir informação sobre AD
 */
export interface RequestWithAD extends Request {
  shouldUseAD?: boolean;
  detectedDomain?: string;
}

/**
 * Middleware para detectar se a requisição vem de um domínio que deve usar AD
 */
export function detectADDomain(req: RequestWithAD, res: Response, next: NextFunction) {
  try {
    // Verificar o header Host para detectar o domínio
    const host = req.get('host') || '';
    const origin = req.get('origin') || '';
    const referer = req.get('referer') || '';
    
    // Verificar em várias fontes
    let detectedDomain = '';
    
    // 1. Header Host (mais confiável)
    if (host) {
      detectedDomain = host;
    }
    // 2. Header Origin
    else if (origin) {
      const url = new URL(origin);
      detectedDomain = url.hostname;
    }
    // 3. Header Referer
    else if (referer) {
      const url = new URL(referer);
      detectedDomain = url.hostname;
    }
    
    // Verificar se o domínio detectado está na lista de domínios que devem usar AD
    const shouldUseAD = AD_ENABLED_DOMAINS.some(domain => 
      detectedDomain === domain || detectedDomain.endsWith(`.${domain}`)
    );
    
    // Adicionar informações ao request
    req.shouldUseAD = shouldUseAD;
    req.detectedDomain = detectedDomain;
    
    // Log para depuração
    if (shouldUseAD) {
      console.log(`🔐 [AD] Domínio detectado para autenticação AD: ${detectedDomain}`);
    }
    
    next();
  } catch (error) {
    console.error('Erro no middleware de detecção de domínio AD:', error);
    // Em caso de erro, continuar sem AD
    req.shouldUseAD = false;
    req.detectedDomain = '';
    next();
  }
}

/**
 * Middleware para verificar se o AD está habilitado para a requisição atual
 */
export function requireAD(req: RequestWithAD, res: Response, next: NextFunction) {
  if (!req.shouldUseAD) {
    return res.status(400).json({ 
      message: 'Autenticação via Active Directory não está disponível para este domínio' 
    });
  }
  next();
}

/**
 * Função para verificar se um domínio específico deve usar AD
 */
export function shouldDomainUseAD(domain: string): boolean {
  return AD_ENABLED_DOMAINS.some(adDomain => 
    domain === adDomain || domain.endsWith(`.${adDomain}`)
  );
} 