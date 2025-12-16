import { randomUUID } from 'crypto';
import { db } from '../db';
import { inventoryResponsibilityTerms, type InventoryResponsibilityTerm, users, userInventoryAssignments, responsibilityTermAssignments } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import s3Service from './s3-service';
import clicksignConfigService from './clicksign-config-service';
import responsibilityTermService from './responsibility-term-service';
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
  documentId?: string; // Adicionado ID do documento para facilitar busca no webhook
  signingUrl: string;
  provider: SupportedSignatureProvider;
  status: 'pending' | 'signed' | 'cancelled';
}

export interface SignatureStatus {
  requestId: string;
  status: 'pending' | 'signed' | 'declined' | 'cancelled';
  signedAt?: string;
  evidenceUrl?: string;
  documentKey?: string; // Chave do documento para download via API
  signersData?: Array<{
    name: string;
    email: string;
    qualification?: {
      document_number?: string;
      phone_number?: string;
    };
  }>;
  webhookPayload?: any; // Payload completo do webhook
}

export interface SignatureProvider {
  sendDocument(options: {
    signerName: string;
    signerEmail: string;
    pdfBuffer: Buffer;
    redirectUrl?: string;
    deliveryResponsibleName?: string;
    deliveryResponsibleEmail?: string;
  }): Promise<SignatureRequestResult>;

  getDocumentStatus(requestId: string): Promise<SignatureStatus>;

  parseWebhook(payload: any): SignatureStatus | null;
}

export class ClicksignProvider implements SignatureProvider {
  private companyId: number | null = null;

  constructor(companyId?: number) {
    this.companyId = companyId || null;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.companyId) {
      throw new Error('Company ID não fornecido para ClicksignProvider');
    }
    const token = await clicksignConfigService.getAccessToken(this.companyId);
    if (!token) {
      throw new Error('Clicksign não configurado para esta empresa. Configure o access token.');
    }
    return token;
  }

  private async getApiUrl(): Promise<string> {
    if (!this.companyId) {
      return process.env.CLICKSIGN_API_URL || 'https://api.clicksign.com';
    }
    return await clicksignConfigService.getApiUrl(this.companyId);
  }

  private async makeRequest(method: string, path: string, data?: any): Promise<any> {
    const accessToken = await this.getAccessToken();
    const apiUrl = await this.getApiUrl();

    // API v3 da ClickSign usa access_token como query parameter
    const url = new URL(path, apiUrl);
    url.searchParams.append('access_token', accessToken);
    
    // DEBUG: Log do payload (omitindo base64 longo)
    if (data?.data?.attributes?.content_base64) {
      console.log('[ClickSign] Payload para API:', {
        method,
        path,
        type: data.data.type,
        attributes: {
          ...data.data.attributes,
          content_base64: `[BASE64 - ${data.data.attributes.content_base64.length} chars]`
        }
      });
    }
    
    const options: https.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/vnd.api+json', // JSON:API format
        'Accept': 'application/json',
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
        // Garantir que o JSON seja serializado corretamente, mesmo com base64 muito longo
        const jsonString = JSON.stringify(data);
        req.write(jsonString, 'utf8');
      }
      
      req.end();
    });
  }


  /**
   * Baixa PDF assinado da ClickSign usando URL ou document_key
   * PRIORIDADE: URL direta do S3 (signed_file_url) - é uma URL pré-assinada que já tem o PDF assinado
   * FALLBACK: API da Clicksign usando document_key
   */
  async downloadSignedPdf(evidenceUrl?: string, documentKey?: string): Promise<Buffer> {
    // PRIORIDADE 1: Usar URL direta do S3 (signed_file_url) - é uma URL pré-assinada, não precisa de autenticação
    if (evidenceUrl) {
      console.log(`[ClickSign] ===== INICIANDO DOWNLOAD VIA URL DIRETA =====`);
      console.log(`[ClickSign] URL completa: ${evidenceUrl}`);
      console.log(`[ClickSign] URL (primeiros 200 chars): ${evidenceUrl.substring(0, 200)}...`);
      
      return new Promise((resolve, reject) => {
        const protocol = evidenceUrl.startsWith('https') ? https : http;
        
        console.log(`[ClickSign] Fazendo requisição GET para a URL...`);
        const req = protocol.get(evidenceUrl, (res) => {
          console.log(`[ClickSign] Resposta recebida! Status: ${res.statusCode}`);
          console.log(`[ClickSign] Headers:`, JSON.stringify(res.headers, null, 2));
          
          if (res.statusCode !== 200) {
            console.error(`[ClickSign] ❌ Falha ao baixar da URL direta - Status: ${res.statusCode} ${res.statusMessage}`);
            // Se falhar, tentar API como fallback
            if (documentKey) {
              console.log(`[ClickSign] Tentando API como fallback com documentKey: ${documentKey}`);
              return this.downloadSignedPdfViaApi(documentKey).then(resolve).catch(reject);
            }
            reject(new Error(`Failed to download signed PDF from URL: ${res.statusCode} - ${res.statusMessage}`));
            return;
          }

          const chunks: Buffer[] = [];
          let totalSize = 0;
          
          res.on('data', (chunk) => {
            chunks.push(chunk);
            totalSize += chunk.length;
            if (chunks.length % 100 === 0) {
              console.log(`[ClickSign] Recebidos ${totalSize} bytes...`);
            }
          });
          
          res.on('end', () => {
            console.log(`[ClickSign] Download completo! Total: ${totalSize} bytes`);
            const buffer = Buffer.concat(chunks);
            
            // Validar que é um PDF (deve começar com %PDF)
            const header = buffer.slice(0, 4).toString('ascii');
            console.log(`[ClickSign] Header do arquivo (primeiros 4 bytes): "${header}"`);
            
            if (buffer.length > 4 && header === '%PDF') {
              console.log(`[ClickSign] ✅✅✅ PDF VÁLIDO BAIXADO COM SUCESSO! ✅✅✅`);
              console.log(`[ClickSign] Tamanho final: ${buffer.length} bytes`);
              resolve(buffer);
            } else {
              console.error(`[ClickSign] ❌ Resposta não é um PDF válido! Header: "${header}"`);
              console.error(`[ClickSign] Primeiros 50 bytes (hex): ${buffer.slice(0, 50).toString('hex')}`);
              // Se não for PDF válido, tentar API como fallback
              if (documentKey) {
                console.log(`[ClickSign] Tentando API como fallback com documentKey: ${documentKey}`);
                return this.downloadSignedPdfViaApi(documentKey).then(resolve).catch(reject);
              }
              reject(new Error(`Resposta não é um PDF válido. Header recebido: "${header}"`));
            }
          });
        });
        
        req.on('error', (error) => {
          console.error(`[ClickSign] ❌ Erro na requisição HTTP:`, error);
          console.error(`[ClickSign] Erro message:`, error.message);
          console.error(`[ClickSign] Erro stack:`, error.stack);
          // Se falhar, tentar API como fallback
          if (documentKey) {
            console.log(`[ClickSign] Tentando API como fallback com documentKey: ${documentKey}`);
            return this.downloadSignedPdfViaApi(documentKey).then(resolve).catch(reject);
          }
          reject(error);
        });
        
        req.on('timeout', () => {
          console.error(`[ClickSign] ❌ Timeout na requisição!`);
          req.destroy();
          if (documentKey) {
            console.log(`[ClickSign] Tentando API como fallback com documentKey: ${documentKey}`);
            return this.downloadSignedPdfViaApi(documentKey).then(resolve).catch(reject);
          }
          reject(new Error('Timeout ao baixar PDF'));
        });
        
        // Timeout de 30 segundos
        req.setTimeout(30000);
      });
    }
    
    // FALLBACK: Usar API da Clicksign se não tiver URL
    if (documentKey) {
      console.log(`[ClickSign] Usando API como fallback com document_key: ${documentKey}`);
      return this.downloadSignedPdfViaApi(documentKey);
    }
    
    throw new Error('Nenhuma URL ou document_key fornecida para download do PDF');
  }

  /**
   * Baixa PDF assinado via API da Clicksign usando document_key
   */
  private async downloadSignedPdfViaApi(documentKey: string): Promise<Buffer> {
    console.log(`[ClickSign] Baixando PDF assinado via API usando document_key: ${documentKey}`);
    try {
      const apiUrl = await this.getApiUrl();
      const accessToken = await this.getAccessToken();
      
      // API v3: GET /api/v3/documents/{document_key}/download
      const url = new URL(`/api/v3/documents/${documentKey}/download`, apiUrl);
      url.searchParams.append('access_token', accessToken);
      
      return new Promise((resolve, reject) => {
        https.get(url.toString(), (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download signed PDF via API: ${res.statusCode} - ${res.statusMessage}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            // Validar que é um PDF (deve começar com %PDF)
            if (buffer.length > 4 && buffer.slice(0, 4).toString('ascii') === '%PDF') {
              console.log(`[ClickSign] PDF baixado via API: ${buffer.length} bytes`);
              resolve(buffer);
            } else {
              reject(new Error('Resposta da API não é um PDF válido'));
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error(`[ClickSign] Erro ao baixar PDF via API:`, error);
      throw error;
    }
  }

  async sendDocument(options: {
    signerName: string;
    signerEmail: string;
    pdfBuffer: Buffer;
    redirectUrl?: string;
    deliveryResponsibleName?: string;
    deliveryResponsibleEmail?: string;
  }): Promise<SignatureRequestResult> {
    try {
      // FLUXO CORRETO API v3 da ClickSign:
      // 1. Criar Envelope
      // 2. Adicionar Documento ao Envelope
      // 3. Adicionar Signatários ao Envelope
      // 4. Criar Requisitos (Requirements) para cada signatário
      // 5. Enviar Notificações

      // 1. Converter PDF Buffer para base64 - EXATAMENTE como funciona na exibição
      // Sem validações extras, sem complicações - apenas converter o Buffer que já funciona
      
      // GARANTIR que seja um Buffer (Puppeteer pode retornar Uint8Array)
      const realBuffer = Buffer.from(options.pdfBuffer);
      
      console.log(`[ClickSign] PDF Buffer recebido: ${realBuffer.length} bytes`);
      console.log(`[ClickSign] PDF header (primeiros 10 bytes):`, Array.from(realBuffer.slice(0, 10)));
      console.log(`[ClickSign] PDF header (string):`, realBuffer.slice(0, 10).toString('ascii'));
      
      const pdfBase64 = realBuffer.toString('base64');
      
      console.log(`[ClickSign] PDF convertido para base64: ${pdfBase64.length} caracteres`);
      console.log(`[ClickSign] Base64 Check (início): ${pdfBase64.substring(0, 20)}`); // Deve começar com JVBERi...

      // 2. Criar Envelope
      const envelopeData = {
        data: {
          type: 'envelopes',
          attributes: {
            name: `Termo de Responsabilidade - ${options.signerName}`,
          }
        }
      };

      const envelopeResponse = await this.makeRequest('POST', '/api/v3/envelopes', envelopeData);
      // JSON:API response format: { data: { id, type, attributes, ... } }
      const envelopeKey = envelopeResponse.data?.id;

      if (!envelopeKey) {
        console.error('Envelope response:', JSON.stringify(envelopeResponse, null, 2));
        throw new Error('Falha ao criar envelope no Clicksign');
      }
      
      console.log('[ClickSign] Envelope criado:', envelopeKey);

      // 3. Adicionar Documento ao Envelope
      const filename = `termo-responsabilidade-${Date.now()}.pdf`;
      
      // Clicksign exige o prefixo data URI com MimeType
      const content_base64_with_mime = `data:application/pdf;base64,${pdfBase64}`;
      
      const documentData = {
        data: {
          type: 'documents',
          attributes: {
            filename: filename,
            content_base64: content_base64_with_mime,
          }
        }
      };

      console.log(`[ClickSign] Criando documento:`, {
        filename,
        base64Length: pdfBase64.length,
        content_base64_length: content_base64_with_mime.length,
        base64Prefix: pdfBase64.substring(0, 20),
        expectedBase64Start: 'JVBERi0x (para %PDF-1.x)',
        content_base64_fullPrefix: content_base64_with_mime.substring(0, 60),
      });

      const documentResponse = await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/documents`, documentData);
      // JSON:API response format: id is in data.id
      const documentKey = documentResponse.data?.id;

      if (!documentKey) {
        console.error('Document response:', JSON.stringify(documentResponse, null, 2));
        throw new Error('Falha ao adicionar documento ao envelope');
      }
      
      console.log('[ClickSign] Documento adicionado:', documentKey);

      // 4. Adicionar Signatários ao Envelope
      // Signatário 1: Funcionário  
      const signer1Data = {
        data: {
          type: 'signers',
          attributes: {
            name: options.signerName,
            email: options.signerEmail,
            has_documentation: true, // ✅ Força solicitação de CPF
          }
        }
      };

      const signer1Response = await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/signers`, signer1Data);
      // JSON:API response format: id is in data.id
      const signer1Key = signer1Response.data?.id;

      if (!signer1Key) {
        console.error('Signer1 response:', JSON.stringify(signer1Response, null, 2));
        throw new Error('Falha ao adicionar signatário ao envelope');
      }
      
      console.log('[ClickSign] Signatário 1 adicionado:', signer1Key);

      // Signatário 2: Responsável da entrega (se fornecido)
      let signer2Key: string | null = null;
      if (options.deliveryResponsibleName && options.deliveryResponsibleEmail) {
        const signer2Data = {
          data: {
            type: 'signers',
            attributes: {
              name: options.deliveryResponsibleName,
              email: options.deliveryResponsibleEmail,
              has_documentation: true, // ✅ Força solicitação de CPF
            }
          }
        };

        const signer2Response = await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/signers`, signer2Data);
        // JSON:API response format: id is in data.id
        signer2Key = signer2Response.data?.id || null;
        
        if (signer2Key) {
          console.log('[ClickSign] Signatário 2 adicionado:', signer2Key);
        }
      }

      // 5. Criar Requisitos (Requirements) - EXATAMENTE como na collection do Postman
      // Requisito de Qualificação para signatário 1
      const qualificationReq1 = {
        data: {
          type: 'requirements',
          attributes: {
            action: 'agree',
            role: 'sign'
          },
          relationships: {
            document: {
              data: { type: 'documents', id: documentKey }
            },
            signer: {
              data: { type: 'signers', id: signer1Key }
            }
          }
        }
      };
      await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/requirements`, qualificationReq1);

      // Requisito de Autenticação para signatário 1
      const authReq1 = {
        data: {
          type: 'requirements',
          attributes: {
            action: 'provide_evidence',
            auth: 'email'
          },
          relationships: {
            document: {
              data: { type: 'documents', id: documentKey }
            },
            signer: {
              data: { type: 'signers', id: signer1Key }
            }
          }
        }
      };
      await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/requirements`, authReq1);

      // Requisitos para o segundo signatário (se existir)
      if (signer2Key) {
        const qualificationReq2 = {
          data: {
            type: 'requirements',
            attributes: {
              action: 'agree',
              role: 'sign'
            },
            relationships: {
              document: {
                data: { type: 'documents', id: documentKey }
              },
              signer: {
                data: { type: 'signers', id: signer2Key }
              }
            }
          }
        };
        await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/requirements`, qualificationReq2);

        const authReq2 = {
          data: {
            type: 'requirements',
            attributes: {
              action: 'provide_evidence',
              auth: 'email'
            },
            relationships: {
              document: {
                data: { type: 'documents', id: documentKey }
              },
              signer: {
                data: { type: 'signers', id: signer2Key }
              }
            }
          }
        };
        await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/requirements`, authReq2);
      }

      // 6. Atualizar Envelope para status "running" (liberar para assinatura)
      const updateEnvelopeData = {
        data: {
          id: envelopeKey,
          type: 'envelopes',
          attributes: {
            status: 'running'
          }
        }
      };
      await this.makeRequest('PATCH', `/api/v3/envelopes/${envelopeKey}`, updateEnvelopeData);
      
      // 7. Enviar Notificações - EXATAMENTE como na collection do Postman
      const notificationData = {
        data: {
          type: 'notifications',
          attributes: {
            message: 'Por favor, assine o Termo de Responsabilidade.'
          }
        }
      };
      await this.makeRequest('POST', `/api/v3/envelopes/${envelopeKey}/notifications`, notificationData);

      // 8. Obter informações do envelope (incluindo URL de assinatura)
      const envelopeInfo = await this.makeRequest('GET', `/api/v3/envelopes/${envelopeKey}`);
      
      // JSON:API: A URL de assinatura está em data.attributes ou included
      const signers = envelopeInfo.included?.filter((item: any) => item.type === 'signers') || [];
      const signer1Info = signers.find((s: any) => s.attributes?.key === signer1Key);
      const signingUrl = signer1Info?.attributes?.url || options.redirectUrl || '';
      
      console.log('[ClickSign] URL de assinatura:', signingUrl);

      return {
        requestId: envelopeKey,
        documentId: documentKey, // Retornar também o ID do documento
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
      // API v3: GET /api/v3/envelopes/{envelope_key}
      const response = await this.makeRequest('GET', `/api/v3/envelopes/${requestId}`);
      const envelope = response.envelope;

      if (!envelope) {
        throw new Error('Envelope não encontrado');
      }

      // Verificar se todos os signatários assinaram
      const allSigned = envelope.signers?.every((signer: any) => signer.status === 'signed') || false;
      const anyCancelled = envelope.signers?.some((signer: any) => signer.status === 'cancelled') || false;
      const anyDeclined = envelope.signers?.some((signer: any) => signer.status === 'declined' || signer.status === 'refused') || false;

      let mappedStatus: 'pending' | 'signed' | 'declined' | 'cancelled' = 'pending';
      if (allSigned) {
        mappedStatus = 'signed';
      } else if (anyDeclined) {
        mappedStatus = 'declined';
      } else if (anyCancelled) {
        mappedStatus = 'cancelled';
      }

      // Evidence URL - URL do documento assinado completo
      const evidenceUrl = envelope.documents?.[0]?.download_url || undefined;
      const signedAt = allSigned ? (envelope.signers?.[0]?.signed_at || undefined) : undefined;

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
    // Webhook da API v3 da ClickSign
    
    // 1. Tentar extrair key do envelope ou documento
    let requestId = payload.envelope?.key;
    
    // Fallback: Se não tem envelope.key, tenta document.key (alguns eventos V3)
    if (!requestId && payload.document?.key) {
      requestId = payload.document.key;
    }

    if (!requestId) {
      return null;
    }

    // 2. Normalizar nome do evento
    let eventName = '';
    if (payload.event && typeof payload.event === 'object' && payload.event.name) {
      eventName = payload.event.name;
    } else if (typeof payload.event === 'string') {
      eventName = payload.event;
    }

    // ✅ Mapear eventos para status
    // Eventos de sucesso: 'sign', 'envelope.signed', 'envelope.finished', 'auto_close', 'document_closed'
    // Eventos de cancelamento: 'cancel', 'envelope.cancelled'
    // Eventos de recusa: 'refuse', 'envelope.refused'
    
    const successEvents = ['sign', 'signed', 'envelope.signed', 'envelope.finished', 'auto_close', 'document_closed', 'finish', 'finished'];
    const cancelEvents = ['cancel', 'canceled', 'envelope.cancelled', 'envelope.canceled'];
    const declineEvents = ['refuse', 'refused', 'envelope.refused', 'envelope.declined', 'decline'];

    if (!successEvents.includes(eventName) && !cancelEvents.includes(eventName) && !declineEvents.includes(eventName)) {
      console.log(`[DigitalSignature] Evento ${eventName} ignorado pelo parser.`);
      return null;
    }

    let mappedStatus: 'pending' | 'signed' | 'declined' | 'cancelled' = 'pending';
    
    if (successEvents.includes(eventName)) {
      mappedStatus = 'signed';
    } else if (declineEvents.includes(eventName)) {
      mappedStatus = 'declined';
    } else if (cancelEvents.includes(eventName)) {
      mappedStatus = 'cancelled';
    }

    // Evidence URL e Datas
    // Tenta pegar do envelope (payload completo) ou do documento
    const envelope = payload.envelope || {};
    const document = payload.document || {};
    
    // 1. PRIORIDADE: Capturar document_key para download via API (método mais confiável)
    let documentKey: string | undefined;
    if (payload.document?.key) {
      documentKey = payload.document.key;
    } else if (document.key) {
      documentKey = document.key;
    } else if (envelope.documents?.[0]?.key) {
      documentKey = envelope.documents[0].key;
    }
    
    // 2. PRIORIDADE: URL do documento ASSINADO
    // Tenta pegar do evento document_closed ou structure downloads
    let evidenceUrl: string | undefined;

    if (payload.document?.downloads?.signed_file_url) {
        evidenceUrl = payload.document.downloads.signed_file_url;
    } else if (document.downloads?.signed_file_url) {
        evidenceUrl = document.downloads.signed_file_url;
    } else if (envelope.documents?.[0]?.downloads?.signed_file_url) {
        evidenceUrl = envelope.documents[0].downloads.signed_file_url;
    } 
    // Check generic download_url only if it explicitly does NOT look like original (though API often serves signed via download_url in finished state)
    // But to be safe, we prioritize signed_file_url above.
    else if (envelope.documents?.[0]?.download_url) {
        evidenceUrl = envelope.documents[0].download_url;
    }

    // ⚠️ JAMAIS usar original_file_url como fallback para evidenceUrl final
    
    console.log(`[DigitalSignature] Document Key extraído: ${documentKey}`);
    console.log(`[DigitalSignature] Evidence URL extraída: ${evidenceUrl}`);

    // Signed At
    const signedAt = payload.event?.occurred_at || new Date().toISOString();

    // ✅ Capturar dados de qualificação dos signatários se disponível
    const signersData = envelope.signers?.map((signer: any) => ({
      name: signer.name || '',
      email: signer.email || '',
      qualification: signer.qualification ? {
        document_number: signer.qualification.document_number,
        phone_number: signer.qualification.phone_number,
      } : undefined,
    })) || [];

    return {
      requestId,
      status: mappedStatus,
      signedAt,
      evidenceUrl,
      documentKey,
      signersData,
    };
  }
}

class MockSignatureProvider implements SignatureProvider {
  constructor(private providerName: SupportedSignatureProvider) {}

  async sendDocument(options: {
    signerName: string;
    signerEmail: string;
    pdfBuffer: Buffer;
    redirectUrl?: string;
    deliveryResponsibleName?: string;
    deliveryResponsibleEmail?: string;
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
    const provider = this.createProvider(providerName, options.companyId);
    const term = await this.getTerm(options.termId, options.companyId);

    if (!term) {
      throw new Error('Termo de responsabilidade não encontrado.');
    }
    
    console.log('[ClickSign] Gerando/regenerando PDF do termo...');
    
    // SEMPRE regenerar o PDF para garantir que temos o Buffer
    const pdfBuffer = await responsibilityTermService.regenerateTermPdf(options.termId, options.companyId);
    
    console.log(`[ClickSign] PDF gerado: ${pdfBuffer.length} bytes`);
    
    // Fazer upload para S3 (para arquivo e histórico)
    let s3Key = term.pdf_s3_key;
    if (!s3Key || s3Key.startsWith('terms/')) {
      const uploadResult = await s3Service.uploadInventoryFile({
        buffer: pdfBuffer,
        originalName: `termo-responsabilidade-${options.termId}.pdf`,
        companyId: options.companyId,
        folder: `terms/${options.termId}`,
        mimeType: 'application/pdf',
        metadata: {
          termId: options.termId,
        },
      });
      
      s3Key = uploadResult.s3Key;
      
      // Atualizar termo com novo S3 key
      await db
        .update(inventoryResponsibilityTerms)
        .set({ pdf_s3_key: s3Key })
        .where(eq(inventoryResponsibilityTerms.id, options.termId));
      
      console.log('[ClickSign] PDF salvo no S3:', s3Key);
    }
    
    // Enviar PDF Buffer DIRETO para ClickSign (sem baixar de URL)
    const request = await provider.sendDocument({
      signerName: options.signerName,
      signerEmail: options.signerEmail,
      pdfBuffer,
      redirectUrl: options.redirectUrl,
      deliveryResponsibleName: options.deliveryResponsibleName,
      deliveryResponsibleEmail: options.deliveryResponsibleEmail,
    });

    console.log(`[DigitalSignature] DEBUG CRÍTICO - Salvando request no banco:`, JSON.stringify(request, null, 2));

    await db
      .update(inventoryResponsibilityTerms)
      .set({
        signature_method: 'digital',
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
    const provider = this.createProvider(term.signature_method as SupportedSignatureProvider, companyId);
    const status = await provider.getDocumentStatus(signatureData.requestId);

    await this.updateTermStatus(termId, status, companyId);
    return status;
  }

  async handleProviderWebhook(providerName: SupportedSignatureProvider, payload: any, companyId?: number) {
    console.log(`[DigitalSignature] handleProviderWebhook: provider=${providerName}, companyId=${companyId}`);
    const provider = this.createProvider(providerName, companyId);
    const status = provider.parseWebhook(payload);
    
    if (!status) {
      console.warn('[DigitalSignature] parseWebhook retornou null (evento ignorado ou inválido)');
      return;
    }
    
    console.log(`[DigitalSignature] Webhook parseado com sucesso. Status: ${status.status}, RequestID: ${status.requestId}`);

    // ✅ Adicionar payload completo ao status para salvar no banco
    status.webhookPayload = payload;

    await this.updateTermStatusByRequestId(providerName, status, companyId, payload);
  }

  /**
   * Processa webhook para um termo específico já identificado
   * Evita ter que buscar o termo novamente no banco
   */
  async handleWebhookForTerm(termId: number, providerName: SupportedSignatureProvider, payload: any, companyId: number) {
    console.log(`[DigitalSignature] handleWebhookForTerm: termId=${termId}, provider=${providerName}`);
    const provider = this.createProvider(providerName, companyId);
    const status = provider.parseWebhook(payload);

    if (!status) {
      console.warn('[DigitalSignature] parseWebhook retornou null (evento ignorado ou inválido)');
      return;
    }

    console.log(`[DigitalSignature] Webhook parseado com sucesso. Status: ${status.status}`);
    
    // Adicionar payload completo
    status.webhookPayload = payload;

    await this.updateTermStatus(termId, status, companyId, payload);
  }

  private async updateTermStatus(termId: number, status: SignatureStatus, companyId: number, webhookPayload?: any) {
    console.log(`[DigitalSignature] updateTermStatus: termId=${termId}, status=${status.status}`);
    // ✅ Salvar payload completo do webhook no status
    if (webhookPayload) {
      status.webhookPayload = webhookPayload;
    }

    const updates: Partial<InventoryResponsibilityTerm> = {
      status: status.status === 'signed' ? 'signed' : status.status === 'declined' ? 'expired' : status.status,
      signature_data: JSON.stringify(status),
    };
    
    if (status.status === 'signed' && status.signedAt) {
      updates.signed_date = new Date(status.signedAt);
      
      // Baixar e salvar PDF assinado
      // PRIORIDADE: evidenceUrl (URL direta do S3) é mais confiável e rápida
      if (status.evidenceUrl || status.documentKey) {
        console.log(`[DigitalSignature] ===== INICIANDO DOWNLOAD DO PDF ASSINADO =====`);
        console.log(`[DigitalSignature] Term ID: ${termId}`);
        console.log(`[DigitalSignature] Evidence URL: ${status.evidenceUrl ? status.evidenceUrl.substring(0, 150) + '...' : 'NÃO FORNECIDA'}`);
        console.log(`[DigitalSignature] Document Key: ${status.documentKey || 'NÃO FORNECIDO'}`);
        
        try {
          const provider = this.createProvider('clicksign', companyId) as ClicksignProvider;
          
          // Passar evidenceUrl PRIMEIRO (prioridade), depois documentKey como fallback
          console.log(`[DigitalSignature] Chamando downloadSignedPdf com evidenceUrl=${!!status.evidenceUrl}, documentKey=${!!status.documentKey}`);
          const pdfBuffer = await provider.downloadSignedPdf(status.evidenceUrl, status.documentKey);
          
          console.log(`[DigitalSignature] PDF baixado com sucesso! Tamanho: ${pdfBuffer.length} bytes`);
          console.log(`[DigitalSignature] Fazendo upload para S3...`);
          
          const uploadResult = await s3Service.uploadSignedTermPdf({
            buffer: pdfBuffer,
            termId,
            companyId,
            mimeType: 'application/pdf',
          });
          
          updates.signed_pdf_s3_key = uploadResult.s3Key;
          console.log(`[DigitalSignature] ✅✅✅ PDF ASSINADO SALVO NO S3 COM SUCESSO! ✅✅✅`);
          console.log(`[DigitalSignature] S3 Key: ${uploadResult.s3Key}`);
          console.log(`[DigitalSignature] ===== DOWNLOAD E SALVAMENTO CONCLUÍDOS =====`);
        } catch (error: any) {
          console.error(`[DigitalSignature] ❌❌❌ ERRO CRÍTICO AO BAIXAR/SALVAR PDF ASSINADO ❌❌❌`);
          console.error(`[DigitalSignature] Term ID: ${termId}`);
          console.error(`[DigitalSignature] Erro:`, error);
          console.error(`[DigitalSignature] Stack:`, error?.stack);
          // NÃO silenciar o erro - vamos relançar para que o usuário saiba que falhou
          // Mas vamos continuar salvando o status mesmo assim
          console.error(`[DigitalSignature] Continuando com atualização do status mesmo com falha no PDF...`);
        }
      } else {
        console.warn('[DigitalSignature] ⚠️ Status é signed mas não tem documentKey nem evidenceUrl');
        console.warn('[DigitalSignature] Payload do webhook pode não ter as informações necessárias');
      }
    }

    // ✅ Atualizar CPF do usuário se necessário
    if (status.status === 'signed' && status.webhookPayload?.envelope?.signers) {
      try {
        await this.updateUserCpfFromWebhook(termId, status.webhookPayload, companyId);
      } catch (error) {
        console.error(`[DigitalSignature] Erro ao atualizar CPF do usuário para termo ${termId}:`, error);
        // Não falhar o processo se a atualização de CPF falhar, apenas logar
      }
    }

        console.log(`[DigitalSignature] Salvando atualizações no banco para termo ${termId}:`, JSON.stringify(updates, null, 2));
        await db
          .update(inventoryResponsibilityTerms)
          .set(updates)
          .where(eq(inventoryResponsibilityTerms.id, termId));

        // ✅ Atualizar status da assinatura na alocação (user_inventory_assignments)
        if (updates.status) {
            // Mapear status do termo para status da alocação
            let assignmentSignatureStatus = 'pending';
            if (updates.status === 'signed') assignmentSignatureStatus = 'signed';
            else if (updates.status === 'sent') assignmentSignatureStatus = 'sent'; // enviado
            else if (updates.status === 'expired' || updates.status === 'declined') assignmentSignatureStatus = 'expired';
            
            // Buscar dados do termo para identificar alocações vinculadas
            const [termData] = await db
                .select({ 
                    assignment_id: inventoryResponsibilityTerms.assignment_id,
                    is_batch_term: inventoryResponsibilityTerms.is_batch_term
                })
                .from(inventoryResponsibilityTerms)
                .where(eq(inventoryResponsibilityTerms.id, termId))
                .limit(1);

            if (termData) {
                const assignmentIdsToUpdate: number[] = [];

                // 1. Se tiver assignment_id direto (termo simples)
                if (termData.assignment_id) {
                    assignmentIdsToUpdate.push(termData.assignment_id);
                }

                // 2. Se for termo em lote, buscar assignments na tabela de relacionamento
                if (termData.is_batch_term) {
                    const batchAssignments = await db
                        .select({ assignment_id: responsibilityTermAssignments.assignment_id })
                        .from(responsibilityTermAssignments)
                        .where(eq(responsibilityTermAssignments.term_id, termId));
                    
                    batchAssignments.forEach(a => assignmentIdsToUpdate.push(a.assignment_id));
                }

                // Remover duplicatas e atualizar
                const uniqueIds = [...new Set(assignmentIdsToUpdate)];
                
                if (uniqueIds.length > 0) {
                    console.log(`[DigitalSignature] Atualizando status da alocação para ${assignmentSignatureStatus} nos IDs: ${uniqueIds.join(', ')}`);
                    await db
                        .update(userInventoryAssignments)
                        .set({ signature_status: assignmentSignatureStatus })
                        .where(inArray(userInventoryAssignments.id, uniqueIds));
                } else {
                    console.warn(`[DigitalSignature] Nenhuma alocação encontrada para atualizar status do termo ${termId}`);
                }
            }
        }

        console.log(`[DigitalSignature] Atualização concluída para termo ${termId}`);
  }

  /**
   * Atualiza CPF do usuário com base nos dados do webhook
   */
  private async updateUserCpfFromWebhook(termId: number, webhookPayload: any, companyId: number): Promise<void> {
    // Buscar termo completo
    const [term] = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(and(
        eq(inventoryResponsibilityTerms.id, termId),
        eq(inventoryResponsibilityTerms.company_id, companyId)
      ))
      .limit(1);

    if (!term) {
      console.warn(`[DigitalSignature] Termo ${termId} não encontrado`);
      return;
    }

    // Buscar signatários no webhook
    const signers = webhookPayload.envelope?.signers || [];
    
    if (signers.length === 0) {
      console.log(`[DigitalSignature] Nenhum signatário encontrado no webhook para termo ${termId}`);
      return;
    }

    // Determinar assignments a processar
    let assignmentsToProcess: Array<{ assignment_id: number; user_id: number }> = [];

    if (term.is_batch_term) {
      // Termo em lote: buscar todos os assignments relacionados
      const termAssignments = await db
        .select({
          assignment_id: responsibilityTermAssignments.assignment_id,
          user_id: userInventoryAssignments.user_id,
        })
        .from(responsibilityTermAssignments)
        .innerJoin(userInventoryAssignments, eq(responsibilityTermAssignments.assignment_id, userInventoryAssignments.id))
        .where(eq(responsibilityTermAssignments.term_id, termId));

      assignmentsToProcess = termAssignments.map(ta => ({
        assignment_id: ta.assignment_id,
        user_id: ta.user_id,
      }));
    } else if (term.assignment_id) {
      // Termo único: buscar assignment direto
      const [assignment] = await db
        .select({
          id: userInventoryAssignments.id,
          user_id: userInventoryAssignments.user_id,
        })
        .from(userInventoryAssignments)
        .where(eq(userInventoryAssignments.id, term.assignment_id))
        .limit(1);

      if (assignment) {
        assignmentsToProcess = [{
          assignment_id: assignment.id,
          user_id: assignment.user_id,
        }];
      }
    }

    if (assignmentsToProcess.length === 0) {
      console.log(`[DigitalSignature] Nenhum assignment encontrado para termo ${termId}`);
      return;
    }

    // Buscar dados de todos os usuários relacionados
    const userIds = [...new Set(assignmentsToProcess.map(a => a.user_id))];
    
    if (userIds.length === 0) {
      console.log(`[DigitalSignature] Nenhum user_id encontrado para termo ${termId}`);
      return;
    }

    const usersData = await db
      .select()
      .from(users)
      .where(and(
        eq(users.company_id, companyId),
        inArray(users.id, userIds)
      ));

    const relevantUsers = usersData;

    // Para cada signatário, tentar atualizar CPF do usuário correspondente
    for (const signer of signers) {
      const signerEmail = signer.email?.toLowerCase().trim();
      if (!signerEmail) continue;

      // Procurar usuário com email correspondente
      const matchingUser = relevantUsers.find(u => {
        const userEmail = u.email?.toLowerCase().trim();
        return userEmail && userEmail === signerEmail;
      });

      if (!matchingUser) {
        console.log(`[DigitalSignature] Nenhum usuário encontrado com email ${signerEmail} para termo ${termId}`);
        continue;
      }

      // Se usuário já tem CPF, não atualizar
      if (matchingUser.cpf) {
        console.log(`[DigitalSignature] Usuário ${matchingUser.id} (${matchingUser.email}) já possui CPF cadastrado, não atualizando`);
        continue;
      }

      // Extrair CPF do signatário
      const cpf = signer.qualification?.document_number;
      
      if (!cpf) {
        console.log(`[DigitalSignature] Signatário ${signerEmail} não possui CPF na qualificação`);
        continue;
      }

      // Atualizar CPF do usuário
      await db
        .update(users)
        .set({ cpf })
        .where(eq(users.id, matchingUser.id));

      console.log(`[DigitalSignature] CPF atualizado automaticamente para usuário ${matchingUser.id} (${matchingUser.email}): ${cpf}`);
    }
  }

  private async updateTermStatusByRequestId(providerName: SupportedSignatureProvider, status: SignatureStatus, companyId?: number, webhookPayload?: any) {
    console.log(`[DigitalSignature] updateTermStatusByRequestId: provider=${providerName}, requestId=${status.requestId}, companyId=${companyId}`);
    
    // Buscar termos com método do provedor OU genérico 'digital'
    const methodsToSearch = [providerName, 'digital'];
    
    const whereConditions = [inArray(inventoryResponsibilityTerms.signature_method, methodsToSearch)];
    if (companyId) {
      whereConditions.push(eq(inventoryResponsibilityTerms.company_id, companyId));
    }

    const terms = await db
      .select()
      .from(inventoryResponsibilityTerms)
      .where(and(...whereConditions));

    const targetTerm = terms.find((term) => {
      if (!term.signature_data) return false;
      try {
        let data: any = term.signature_data;
        // Tratamento robusto para JSON ou String (igual ao webhook)
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch {}
            // Se ainda for string, parsear de novo (double stringify)
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch {}
            }
        }
        
        const casted = data as { requestId?: string; documentId?: string };
        
        if (casted.requestId === status.requestId) return true;
        
        // Se status.requestId for na verdade o ID do documento (alguns webhooks mandam assim)
        if (casted.documentId && casted.documentId === status.requestId) return true;
        
        return false;
      } catch {
        return false;
      }
    });

    if (!targetTerm) {
      console.warn(`[DigitalSignature] Termo não encontrado para RequestID: ${status.requestId}`);
      return;
    }
    
    console.log(`[DigitalSignature] Termo encontrado para atualização: ${targetTerm.id}`);
    await this.updateTermStatus(targetTerm.id, status, targetTerm.company_id, webhookPayload);
  }

  private createProvider(providerName: SupportedSignatureProvider, companyId?: number): SignatureProvider {
    switch (providerName) {
      case 'docusign':
        return new MockSignatureProvider('docusign');
      case 'clicksign':
        return new ClicksignProvider(companyId);
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

