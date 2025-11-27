import { Request, Response } from 'express';
import digitalSignatureService from '../services/digital-signature-service';
import clicksignConfigService from '../services/clicksign-config-service';
import { db } from '../db';
import { inventoryResponsibilityTerms } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Valida o webhook secret da ClickSign
 */
function validateWebhookSecret(payload: any, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    // A ClickSign pode enviar o signature em diferentes formatos
    // Normalmente vem como HMAC SHA256 do payload
    let payloadToUpdate: string | Buffer;

    if (Buffer.isBuffer(payload)) {
        payloadToUpdate = payload;
    } else if (typeof payload === 'string') {
        payloadToUpdate = payload;
    } else {
        payloadToUpdate = JSON.stringify(payload);
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadToUpdate)
      .digest('hex');

    // Comparar de forma segura (timing-safe)
    // Normalizar ambos para hex antes de comparar
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    console.error('[Clicksign Webhook] Erro ao validar signature:', error);
    return false;
  }
}

/**
 * Endpoint para receber webhooks da ClickSign
 */
export async function handleClicksignWebhook(req: Request, res: Response) {
  const requestId = crypto.randomUUID();
  console.log(`[Clicksign Webhook ${requestId}] Recebido POST /api/webhooks/clicksign`);
  
  try {
    const payload = req.body;
    // Tentar obter assinatura de múltiplos headers possíveis
    let signature = req.headers['x-clicksign-signature'] as string | undefined;
    
    if (!signature && req.headers['content-hmac']) {
        // Content-Hmac vem no formato "sha256=..."
        const hmacHeader = req.headers['content-hmac'] as string;
        signature = hmacHeader.replace('sha256=', '');
    }

    console.log(`[Clicksign Webhook ${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[Clicksign Webhook ${requestId}] Payload recebido:`, JSON.stringify(payload, null, 2));

    // Validar estrutura básica do payload
    if (!payload?.envelope?.key && !payload?.document?.key) {
      console.warn(`[Clicksign Webhook ${requestId}] Payload inválido:`, payload);
      return res.status(400).json({ success: false, message: 'Payload inválido' });
    }

    // Normalizar nome do evento (API V3 manda objeto, V2 manda string)
    let eventName = '';
    if (payload.event && typeof payload.event === 'object' && payload.event.name) {
      eventName = payload.event.name;
    } else if (typeof payload.event === 'string') {
      eventName = payload.event;
    }

    console.log(`[Clicksign Webhook ${requestId}] Recebido evento: ${eventName}`);

    // IGNORAR eventos que ocorrem durante a criação (evita erro de Race Condition no banco)
    // upload, add_signer, create, etc. não nos interessam, apenas o resultado final.
    const relevantEvents = ['sign', 'signed', 'envelope.signed', 'envelope.finished', 'finish', 'finished', 'auto_close', 'document_closed', 'cancel', 'canceled', 'envelope.cancelled', 'envelope.canceled'];
    
    if (!relevantEvents.includes(eventName)) {
      console.log(`[Clicksign Webhook ${requestId}] Ignorando evento irrelevante para status final: ${eventName}`);
      return res.status(200).json({ success: true, message: 'Evento ignorado' });
    }

    // Extrair chaves possíveis para busca
    const keysToSearch = [];
    if (payload.envelope?.key) keysToSearch.push(payload.envelope.key);
    if (payload.document?.key) keysToSearch.push(payload.document.key);
    
    console.log(`[Clicksign Webhook ${requestId}] Processando evento relevante: ${eventName}`);
    console.log(`[Clicksign Webhook ${requestId}] Chaves para busca: ${keysToSearch.join(', ')}`);

    // Buscar termos candidatos
    const terms = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(inArray(inventoryResponsibilityTerms.signature_method, ['clicksign', 'digital']));

    console.log(`[Clicksign Webhook ${requestId}] Total de termos Clicksign encontrados no banco: ${terms.length}`);

    // DEBUG EXTREMO: Listar o que temos no banco para entender por que não está batendo
    terms.forEach(t => {
        try {
            let rawData = t.signature_data;
            // Tentar parsear. Se for string, parsear de novo (caso de double stringify)
            let d: any = {};
            if (typeof rawData === 'string') {
                try {
                    d = JSON.parse(rawData);
                } catch (e) {
                    console.log(`[DEBUG BANCO] Termo ID ${t.id}: FALHA AO PARSEAR JSON PRIMÁRIO. Conteúdo: ${rawData}`);
                    return;
                }
                
                if (typeof d === 'string') {
                     try {
                        d = JSON.parse(d);
                     } catch (e) {
                        console.log(`[DEBUG BANCO] Termo ID ${t.id}: FALHA AO PARSEAR JSON SECUNDÁRIO (double stringify?). Conteúdo: ${d}`);
                     }
                }
            } else if (typeof rawData === 'object') {
                d = rawData;
            }

            // Só logar se tiver algum ID para não poluir demais
            if (d && (d.requestId || d.documentId)) {
                console.log(`[DEBUG BANCO] Termo ID ${t.id}: requestId=${d.requestId}, documentId=${d.documentId}`);
            } else {
                 console.log(`[DEBUG BANCO] Termo ID ${t.id}: Objeto sem IDs. Keys: ${Object.keys(d || {}).join(', ')}`);
            }
        } catch (e) {
            console.log(`[DEBUG BANCO] Termo ID ${t.id}: Erro genérico no debug: ${e}`);
        }
    });

    const targetTerm = terms.find((term) => {
      if (!term.signature_data) return false;
      try {
        let data: any = term.signature_data;
        // Tratamento robusto para JSON ou String
        if (typeof data === 'string') {
            data = JSON.parse(data);
            // Se ainda for string, parsear de novo (double stringify)
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
        }
        
        const castedData = data as { requestId?: string; documentId?: string };
        // Verificar se requestId bate com alguma das chaves recebidas
        // OU se documentId bate com alguma das chaves recebidas
        
        let match = false;
        if (castedData.requestId && keysToSearch.includes(castedData.requestId)) {
          match = true;
        } else if (castedData.documentId && keysToSearch.includes(castedData.documentId)) {
          match = true;
        }
        
        if (match) {
          console.log(`[Clicksign Webhook ${requestId}] Termo encontrado! ID: ${term.id}, Status Atual: ${term.status}, RequestID: ${castedData.requestId}, DocumentID: ${castedData.documentId}`);
        }
        return match;
      } catch (e) {
        return false;
      }
    });

    if (!targetTerm) {
      console.warn(`[Clicksign Webhook ${requestId}] Termo NÃO encontrado para chaves: ${keysToSearch.join(', ')}`);
      // Logar alguns requestIds disponíveis para debug
      terms.slice(0, 5).forEach(t => {
        try {
           const d = JSON.parse(t.signature_data || '{}');
           console.log(`[Clicksign Webhook ${requestId}] Termo ${t.id} tem requestId: ${d.requestId}`);
        } catch {}
      });
      
      // Retornar 200 para evitar retries da ClickSign
      return res.status(200).json({ success: false, message: 'Termo não encontrado' });
    }

    // Validar webhook secret se configurado
    const webhookSecret = await clicksignConfigService.getWebhookSecret(targetTerm.company_id);
    if (webhookSecret) {
      console.log(`[Clicksign Webhook ${requestId}] Validando assinatura com secret configurado...`);
      if (!signature) {
        console.warn(`[Clicksign Webhook ${requestId}] Signature header ausente`);
        return res.status(401).json({ success: false, message: 'Signature ausente' });
      }

      // Usar rawBody se disponível (garante hash correto), senão fallback para JSON.stringify
      const payloadToValidate = (req as any).rawBody || JSON.stringify(payload);
      
      const isValid = validateWebhookSecret(payloadToValidate, signature, webhookSecret);
      
      if (!isValid) {
        console.warn(`[Clicksign Webhook ${requestId}] Signature inválida (Hash recebido: ${signature})`);
        return res.status(401).json({ success: false, message: 'Signature inválida' });
      }
      console.log(`[Clicksign Webhook ${requestId}] Assinatura válida!`);
    } else {
      console.log(`[Clicksign Webhook ${requestId}] Nenhum webhook secret configurado, pulando validação de assinatura.`);
    }

    // Processar webhook
    console.log(`[Clicksign Webhook ${requestId}] Enviando para digitalSignatureService via handleWebhookForTerm (ID: ${targetTerm.id})...`);
    
    // USAR O NOVO MÉTODO DIRETO QUE NÃO PRECISA BUSCAR O TERMO NOVAMENTE
    await digitalSignatureService.handleWebhookForTerm(targetTerm.id, 'clicksign', payload, targetTerm.company_id);

    console.log(`[Clicksign Webhook ${requestId}] Webhook processado com sucesso para termo ${targetTerm.id}`);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Clicksign Webhook ${requestId}] Erro CRÍTICO ao processar webhook:`, error);
    // Retornar 200 para evitar retries em caso de erro interno
    res.status(200).json({ success: false, message: 'Erro ao processar webhook' });
  }
}

