import { randomUUID } from 'crypto';
import { db } from '../db';
import { inventoryResponsibilityTerms, type InventoryResponsibilityTerm } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import s3Service from './s3-service';

export type SupportedSignatureProvider = 'docusign' | 'clicksign' | 'd4sign' | 'mock';

export interface SignatureRequestOptions {
  termId: number;
  signerName: string;
  signerEmail: string;
  provider?: SupportedSignatureProvider;
  redirectUrl?: string;
  companyId: number;
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
        return new MockSignatureProvider('clicksign');
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

