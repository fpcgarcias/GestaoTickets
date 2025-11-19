import { randomUUID } from 'crypto';
import { db } from '../db';
import { inventoryResponsibilityTerms, type InventoryResponsibilityTerm } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import s3Service from './s3-service';
import https from 'https';
import http from 'http';

export type SupportedSignatureProvider = 'docusign' | 'clicksign' | 'd4sign' | 'mock';

export interface SignatureRequestOptions {
  termId: number;
  signerName: string;
  signerEmail: string;
  provider?: SupportedSignatureProvider;
  redirectUrl?: string;
  companyId: number;
  deliveryResponsibleName?: string;
  deliveryResponsibleEmail?: string;
}

export interface SignatureRequestResult {
  requestId: string;
  signingUrl: string;
  provider: SupportedSignatureProvider;
  status: 'pending' | 'signed' | 'cancelled';
}

export interface SignatureStatus {
  requestId: string;
  status: 'pending' | 'signed' | 'declined' | 'cancelled';
  signedAt?: string;
  evidenceUrl?: string;
}

export interface SignatureProvider {
  sendDocument(options: {
    signerName: string;
    signerEmail: string;
    fileUrl: string;
    redirectUrl?: string;
  }): Promise<SignatureRequestResult>;

  getDocumentStatus(requestId: string): Promise<SignatureStatus>;

  parseWebhook(payload: any): SignatureStatus | null;
}

class ClicksignProvider implements SignatureProvider {
  private accessToken: string;
  private apiUrl: string;

  constructor() {
    this.accessToken = process.env.CLICKSIGN_ACCESS_TOKEN || '';
    this.apiUrl = process.env.CLICKSIGN_API_URL || 'https://api.clicksign.com';
    
    if (!this.accessToken) {
      console.warn('CLICKSIGN_ACCESS_TOKEN não configurado. Usando modo mock.');
    }
  }

  private async makeRequest(method: string, path: string, data?: any): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Clicksign não configurado. Configure CLICKSIGN_ACCESS_TOKEN.');
    }

    const url = new URL(path, this.apiUrl);
    const options: https.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Clicksign API error: ${res.statusCode} - ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  private async downloadFileAsBase64(fileUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = fileUrl.startsWith('https') ? https : http;
      
      protocol.get(fileUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          resolve(base64);
        });
      }).on('error', reject);
    });
  }

  async sendDocument(options: {
    signerName: string;
    signerEmail: string;
    fileUrl: string;
    redirectUrl?: string;
    deliveryResponsibleName?: string;
    deliveryResponsibleEmail?: string;
  }): Promise<SignatureRequestResult> {
    try {
      // 1. Fazer download do PDF e converter para base64
      const pdfBase64 = await this.downloadFileAsBase64(options.fileUrl);

      // 2. Criar documento no Clicksign
      // API 3.0 usa Envelope, mas primeiro precisamos criar o documento
      const documentData = {
        document: {
          path: `/termo-responsabilidade-${Date.now()}.pdf`,
          content_base64: pdfBase64,
        },
      };

      const documentResponse = await this.makeRequest('POST', '/api/v3/documents', documentData);
      const documentKey = documentResponse.document?.key;

      if (!documentKey) {
        throw new Error('Falha ao criar documento no Clicksign');
      }

      // 3. Criar envelope (API 3.0)
      const envelopeData = {
        envelope: {
          name: `Termo de Responsabilidade - ${options.signerName}`,
          documents: [documentKey],
        },
      };

      const envelopeResponse = await this.makeRequest('POST', '/api/v3/envelopes', envelopeData);
      const envelopeKey = envelopeResponse.envelope?.key;

      if (!envelopeKey) {
        throw new Error('Falha ao criar envelope no Clicksign');
      }

      // 4. Adicionar signatários
      // Signatário 1: Funcionário (assinatura principal)
      const signer1Data = {
        signer: {
          name: options.signerName,
          email: options.signerEmail,
          auths: ['email'], // Autenticação por e-mail
          documentation: null,
          delivery: 'email',
        },
      };

      const signer1Response = await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/signers`, signer1Data);
      const signer1Key = signer1Response.signer?.key;

      // Signatário 2: Responsável da entrega (se fornecido)
      let signer2Key: string | null = null;
      if (options.deliveryResponsibleName && options.deliveryResponsibleEmail) {
        const signer2Data = {
          signer: {
            name: options.deliveryResponsibleName,
            email: options.deliveryResponsibleEmail,
            auths: ['email'],
            documentation: null,
            delivery: 'email',
          },
        };

        const signer2Response = await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/signers`, signer2Data);
        signer2Key = signer2Response.signer?.key || null;
      }

      // 5. Adicionar posições de assinatura no documento
      // Coordenadas aproximadas baseadas no template A4 (595x842 pontos)
      // Assinatura do funcionário: lado esquerdo, parte inferior
      const signature1Data = {
        signature: {
          x: 100, // Posição X (esquerda)
          y: 700, // Posição Y (parte inferior)
          width: 200,
          height: 50,
        },
      };

      await this.makeRequest('POST', `/api/v3/documents/${documentKey}/signers/${signer1Key}/signatures`, signature1Data);

      // Assinatura do responsável: lado direito, parte inferior
      if (signer2Key) {
        const signature2Data = {
          signature: {
            x: 350, // Posição X (direita)
            y: 700, // Posição Y (parte inferior)
            width: 200,
            height: 50,
          },
        };

        await this.makeRequest('POST', `/api/v3/documents/${documentKey}/signers/${signer2Key}/signatures`, signature2Data);
      }

      // 6. Finalizar envelope e enviar para assinatura
      await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/finish`);

      // 7. Obter URL de assinatura
      const envelopeInfo = await this.makeRequest('GET', `/api/v3/envelopes/${envelopeKey}`);
      const signingUrl = envelopeInfo.envelope?.signers?.[0]?.url || options.redirectUrl || '';

      return {
        requestId: envelopeKey,
        signingUrl,
        provider: 'clicksign',
        status: 'pending',
      };
    } catch (error: any) {
      console.error('Erro ao enviar documento para Clicksign:', error);
      throw new Error(`Falha ao enviar para Clicksign: ${error.message}`);
    }
  }

  async getDocumentStatus(requestId: string): Promise<SignatureStatus> {
    try {
      const envelopeInfo = await this.makeRequest('GET', `/api/v3/envelopes/${requestId}`);
      
      const status = envelopeInfo.envelope?.status || 'pending';
      const signedAt = envelopeInfo.envelope?.signed_at || undefined;
      const evidenceUrl = envelopeInfo.envelope?.evidence_url || undefined;

      let mappedStatus: 'pending' | 'signed' | 'declined' | 'cancelled' = 'pending';
      if (status === 'signed' || status === 'completed') {
        mappedStatus = 'signed';
      } else if (status === 'declined' || status === 'refused') {
        mappedStatus = 'declined';
      } else if (status === 'cancelled') {
        mappedStatus = 'cancelled';
      }

      return {
        requestId,
        status: mappedStatus,
        signedAt,
        evidenceUrl,
      };
    } catch (error: any) {
      console.error('Erro ao buscar status do Clicksign:', error);
      return {
        requestId,
        status: 'pending',
      };
    }
  }

  parseWebhook(payload: any): SignatureStatus | null {
    // Webhook do Clicksign pode ter diferentes formatos
    // Ajustar conforme documentação oficial
    if (!payload?.envelope?.key && !payload?.document?.key) {
      return null;
    }

    const requestId = payload.envelope?.key || payload.document?.key;
    const status = payload.envelope?.status || payload.document?.status || 'pending';
    const signedAt = payload.envelope?.signed_at || payload.document?.signed_at;

    let mappedStatus: 'pending' | 'signed' | 'declined' | 'cancelled' = 'pending';
    if (status === 'signed' || status === 'completed') {
      mappedStatus = 'signed';
    } else if (status === 'declined' || status === 'refused') {
      mappedStatus = 'declined';
    } else if (status === 'cancelled') {
      mappedStatus = 'cancelled';
    }

    return {
      requestId,
      status: mappedStatus,
      signedAt,
      evidenceUrl: payload.envelope?.evidence_url || payload.document?.evidence_url,
    };
  }
}

class MockSignatureProvider implements SignatureProvider {
  constructor(private providerName: SupportedSignatureProvider) {}

  async sendDocument(options: {
    signerName: string;
    signerEmail: string;
    fileUrl: string;
    redirectUrl?: string;
  }): Promise<SignatureRequestResult> {
    const requestId = randomUUID();
    const signingUrl = options.redirectUrl
      ? `${options.redirectUrl}?requestId=${requestId}`
      : `https://signature.mock/${requestId}`;
    return {
      requestId,
      signingUrl,
      provider: this.providerName,
      status: 'pending',
    };
  }

  async getDocumentStatus(requestId: string): Promise<SignatureStatus> {
    return {
      requestId,
      status: 'pending',
    };
  }

  parseWebhook(payload: any): SignatureStatus | null {
    if (!payload?.requestId) return null;
    return {
      requestId: payload.requestId,
      status: payload.status || 'pending',
      signedAt: payload.signedAt,
      evidenceUrl: payload.evidenceUrl,
    };
  }
}

class DigitalSignatureService {
  private defaultProvider: SupportedSignatureProvider;

  constructor() {
    const envProvider = (process.env.SIGNATURE_PROVIDER?.toLowerCase() ?? 'mock') as SupportedSignatureProvider;
    this.defaultProvider = envProvider;
  }

  async requestSignature(options: SignatureRequestOptions): Promise<SignatureRequestResult> {
    const providerName = options.provider ?? this.defaultProvider;
    const provider = this.createProvider(providerName);
    const term = await this.getTerm(options.termId, options.companyId);

    if (!term) {
      throw new Error('Termo de responsabilidade não encontrado.');
    }
    if (!term.pdf_s3_key) {
      throw new Error('Termo não possui PDF associado.');
    }

    const fileUrl = await s3Service.getDownloadUrl(term.pdf_s3_key);
    const request = await provider.sendDocument({
      signerName: options.signerName,
      signerEmail: options.signerEmail,
      fileUrl,
      redirectUrl: options.redirectUrl,
      deliveryResponsibleName: options.deliveryResponsibleName,
      deliveryResponsibleEmail: options.deliveryResponsibleEmail,
    });

    await db
      .update(inventoryResponsibilityTerms)
      .set({
        signature_method: providerName,
        signature_data: JSON.stringify(request),
        status: 'pending',
      })
      .where(eq(inventoryResponsibilityTerms.id, options.termId));

    return request;
  }

  async refreshSignatureStatus(termId: number, companyId: number): Promise<SignatureStatus> {
    const term = await this.getTerm(termId, companyId);
    if (!term?.signature_data || !term.signature_method) {
      throw new Error('Termo não possui solicitação de assinatura ativa.');
    }

    const signatureData = JSON.parse(term.signature_data) as SignatureRequestResult;
    const provider = this.createProvider(term.signature_method as SupportedSignatureProvider);
    const status = await provider.getDocumentStatus(signatureData.requestId);

    await this.updateTermStatus(termId, status);
    return status;
  }

  async handleProviderWebhook(providerName: SupportedSignatureProvider, payload: any) {
    const provider = this.createProvider(providerName);
    const status = provider.parseWebhook(payload);
    if (!status) return;

    await this.updateTermStatusByRequestId(providerName, status);
  }

  private async updateTermStatus(termId: number, status: SignatureStatus) {
    const updates: Partial<InventoryResponsibilityTerm> = {
      status: status.status === 'signed' ? 'signed' : status.status === 'declined' ? 'expired' : status.status,
      signature_data: JSON.stringify(status),
    };
    if (status.status === 'signed' && status.signedAt) {
      updates.signed_date = new Date(status.signedAt);
    }

    await db
      .update(inventoryResponsibilityTerms)
      .set(updates)
      .where(eq(inventoryResponsibilityTerms.id, termId));
  }

  private async updateTermStatusByRequestId(providerName: SupportedSignatureProvider, status: SignatureStatus) {
    const terms = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(eq(inventoryResponsibilityTerms.signature_method, providerName));

    const targetTerm = terms.find((term) => {
      if (!term.signature_data) return false;
      try {
        const data = JSON.parse(term.signature_data) as { requestId?: string };
        return data.requestId === status.requestId;
      } catch {
        return false;
      }
    });

    if (!targetTerm) return;
    await this.updateTermStatus(targetTerm.id, status);
  }

  private createProvider(providerName: SupportedSignatureProvider): SignatureProvider {
    switch (providerName) {
      case 'docusign':
        return new MockSignatureProvider('docusign');
      case 'clicksign':
        return new ClicksignProvider();
      case 'd4sign':
        return new MockSignatureProvider('d4sign');
      default:
        return new MockSignatureProvider('mock');
    }
  }

  private async getTerm(termId: number, companyId: number) {
    const [term] = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(and(
        eq(inventoryResponsibilityTerms.id, termId),
        eq(inventoryResponsibilityTerms.company_id, companyId)
      ))
      .limit(1);
    return term ?? null;
  }
}

export const digitalSignatureService = new DigitalSignatureService();
export default digitalSignatureService;

