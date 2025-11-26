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
  signingUrl: string;
  provider: SupportedSignatureProvider;
  status: 'pending' | 'signed' | 'cancelled';
}

export interface SignatureStatus {
  requestId: string;
  status: 'pending' | 'signed' | 'declined' | 'cancelled';
  signedAt?: string;
  evidenceUrl?: string;
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
   * Baixa PDF assinado da ClickSign
   */
  async downloadSignedPdf(evidenceUrl: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = evidenceUrl.startsWith('https') ? https : http;
      
      protocol.get(evidenceUrl, async (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download signed PDF: ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
      }).on('error', reject);
    });
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
    // Eventos: envelope.signed, envelope.finished, envelope.cancelled, envelope.declined
    if (!payload?.envelope?.key) {
      return null;
    }

    const requestId = payload.envelope.key;
    const event = payload.event; // envelope.signed, envelope.finished, etc.
    const envelope = payload.envelope;

    // ✅ Filtrar apenas eventos relevantes onde dados de qualificação estão completos
    // Processar apenas quando envelope.finished ou envelope.signed
    if (event !== 'envelope.finished' && event !== 'envelope.signed') {
      console.log(`[Clicksign Webhook] Evento ${event} ignorado - processando apenas envelope.finished e envelope.signed`);
      return null;
    }

    // Verificar status dos signatários
    const allSigned = envelope.signers?.every((signer: any) => signer.status === 'signed') || false;
    const anyCancelled = envelope.signers?.some((signer: any) => signer.status === 'cancelled') || false;
    const anyDeclined = envelope.signers?.some((signer: any) => signer.status === 'declined' || signer.status === 'refused') || false;

    let mappedStatus: 'pending' | 'signed' | 'declined' | 'cancelled' = 'pending';
    if (event === 'envelope.signed' || event === 'envelope.finished' || allSigned) {
      mappedStatus = 'signed';
    } else if (event === 'envelope.declined' || anyDeclined) {
      mappedStatus = 'declined';
    } else if (event === 'envelope.cancelled' || anyCancelled) {
      mappedStatus = 'cancelled';
    }

    // Evidence URL - URL do documento assinado completo
    const evidenceUrl = envelope.documents?.[0]?.download_url || undefined;
    const signedAt = envelope.signers?.[0]?.signed_at || undefined;

    // ✅ Capturar dados de qualificação dos signatários
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
    const provider = this.createProvider(providerName, companyId);
    const status = provider.parseWebhook(payload);
    if (!status) return;

    // ✅ Adicionar payload completo ao status para salvar no banco
    status.webhookPayload = payload;

    await this.updateTermStatusByRequestId(providerName, status, companyId, payload);
  }

  private async updateTermStatus(termId: number, status: SignatureStatus, companyId: number, webhookPayload?: any) {
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
      
      // Se temos evidenceUrl, baixar e salvar PDF assinado
      if (status.evidenceUrl) {
        try {
          const provider = this.createProvider('clicksign', companyId) as ClicksignProvider;
          const pdfBuffer = await provider.downloadSignedPdf(status.evidenceUrl);
          
          const uploadResult = await s3Service.uploadSignedTermPdf({
            buffer: pdfBuffer,
            termId,
            companyId,
            mimeType: 'application/pdf',
          });
          
          updates.signed_pdf_s3_key = uploadResult.s3Key;
        } catch (error) {
          console.error(`[DigitalSignature] Erro ao baixar/salvar PDF assinado para termo ${termId}:`, error);
          // Não falhar o processo se o download falhar, apenas logar
        }
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

    await db
      .update(inventoryResponsibilityTerms)
      .set(updates)
      .where(eq(inventoryResponsibilityTerms.id, termId));
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
    const whereConditions = [eq(inventoryResponsibilityTerms.signature_method, providerName)];
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
        const data = JSON.parse(term.signature_data) as { requestId?: string };
        return data.requestId === status.requestId;
      } catch {
        return false;
      }
    });

    if (!targetTerm) return;
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

