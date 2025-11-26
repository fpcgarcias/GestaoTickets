import { Request, Response } from 'express';
import digitalSignatureService from '../services/digital-signature-service';
import clicksignConfigService from '../services/clicksign-config-service';
import { db } from '../db';
import { inventoryResponsibilityTerms } from '@shared/schema';
import { eq } from 'drizzle-orm';
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
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
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
  try {
    const payload = req.body;
    const signature = req.headers['x-clicksign-signature'] as string | undefined;

    // Validar estrutura básica do payload
    if (!payload?.envelope?.key && !payload?.document?.key) {
      console.warn('[Clicksign Webhook] Payload inválido:', payload);
      return res.status(400).json({ success: false, message: 'Payload inválido' });
    }

    // Extrair envelope key para identificar o termo
    const envelopeKey = payload.envelope?.key || payload.document?.key;

    // Buscar termo pelo requestId (envelope.key)
    const terms = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(eq(inventoryResponsibilityTerms.signature_method, 'clicksign'));

    const targetTerm = terms.find((term) => {
      if (!term.signature_data) return false;
      try {
        const data = JSON.parse(term.signature_data) as { requestId?: string };
        return data.requestId === envelopeKey;
      } catch {
        return false;
      }
    });

    if (!targetTerm) {
      console.warn(`[Clicksign Webhook] Termo não encontrado para envelope.key: ${envelopeKey}`);
      // Retornar 200 para evitar retries da ClickSign
      return res.status(200).json({ success: false, message: 'Termo não encontrado' });
    }

    // Validar webhook secret se configurado
    const webhookSecret = await clicksignConfigService.getWebhookSecret(targetTerm.company_id);
    if (webhookSecret) {
      if (!signature) {
        console.warn('[Clicksign Webhook] Signature header ausente');
        return res.status(401).json({ success: false, message: 'Signature ausente' });
      }

      const isValid = validateWebhookSecret(JSON.stringify(payload), signature, webhookSecret);
      if (!isValid) {
        console.warn('[Clicksign Webhook] Signature inválida');
        return res.status(401).json({ success: false, message: 'Signature inválida' });
      }
    }

    // Processar webhook
    await digitalSignatureService.handleProviderWebhook('clicksign', payload, targetTerm.company_id);

    console.log(`[Clicksign Webhook] Webhook processado com sucesso para termo ${targetTerm.id}`);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Clicksign Webhook] Erro ao processar webhook:', error);
    // Retornar 200 para evitar retries em caso de erro interno
    res.status(200).json({ success: false, message: 'Erro ao processar webhook' });
  }
}

