import QRCode from 'qrcode';
import { db } from '../db';
import { inventoryProducts, inventoryLocations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import s3Service from './s3-service';

export type QRCodeFormat = 'png' | 'svg';

export interface QRCodeOptions {
  format?: QRCodeFormat;
  scale?: number;
  label?: string;
  store?: boolean;
  userId?: number;
}

export interface QRCodeResult {
  buffer: Buffer;
  mimeType: string;
  dataUrl: string;
  metadata: Record<string, string | number>;
  storageKey?: string;
}

class QRCodeService {
  async generateProductCode(
    productId: number,
    companyId: number,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    const product = await this.getProduct(productId, companyId);
    if (!product) {
      throw new Error('Produto não encontrado para gerar QR Code.');
    }

    const payload = this.buildPayload('product', companyId, productId);
    const label = options.label ?? product.name;

    return this.generateCode({
      payload,
      label,
      filename: `produto-${productId}`,
      companyId,
      folder: `qrcodes/products/${productId}`,
      store: options.store ?? false,
      format: options.format,
      scale: options.scale,
      metadata: {
        productId,
        companyId,
        label,
        type: 'product',
      },
    });
  }

  async generateLocationCode(
    locationId: number,
    companyId: number,
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult> {
    const location = await this.getLocation(locationId, companyId);
    if (!location) {
      throw new Error('Localização não encontrada para gerar QR Code.');
    }

    const payload = this.buildPayload('location', companyId, locationId);
    const label = options.label ?? location.name;

    return this.generateCode({
      payload,
      label,
      filename: `local-${locationId}`,
      companyId,
      folder: `qrcodes/locations/${locationId}`,
      store: options.store ?? false,
      format: options.format,
      scale: options.scale,
      metadata: {
        locationId,
        companyId,
        label,
        type: 'location',
      },
    });
  }

  private async generateCode(params: {
    payload: string;
    label: string;
    filename: string;
    companyId: number;
    folder: string;
    store: boolean;
    format?: QRCodeFormat;
    scale?: number;
    metadata: Record<string, string | number>;
  }): Promise<QRCodeResult> {
    const format = params.format ?? 'png';
    const mimeType = format === 'svg' ? 'image/svg+xml' : 'image/png';

    const buffer = await QRCode.toBuffer(params.payload, {
      type: format === 'svg' ? 'svg' : 'png',
      margin: 1,
      scale: params.scale ?? 6,
    });

    let storageKey: string | undefined;
    if (params.store) {
      const upload = await s3Service.uploadInventoryFile({
        buffer,
        originalName: `${params.filename}.${format}`,
        companyId: params.companyId,
        folder: params.folder,
        mimeType,
        metadata: params.metadata,
      });
      storageKey = upload.s3Key;
    }

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;

    return {
      buffer,
      mimeType,
      dataUrl,
      metadata: params.metadata,
      storageKey,
    };
  }

  private buildPayload(type: string, companyId: number, referenceId: number): string {
    return JSON.stringify({
      type,
      companyId,
      referenceId,
      generatedAt: new Date().toISOString(),
    });
  }

  private async getProduct(productId: number, companyId: number) {
    const [product] = await db
      .select()
      .from(inventoryProducts)
      .where(and(
        eq(inventoryProducts.id, productId),
        eq(inventoryProducts.company_id, companyId)
      ))
      .limit(1);
    return product ?? null;
  }

  private async getLocation(locationId: number, companyId: number) {
    const [location] = await db
      .select()
      .from(inventoryLocations)
      .where(and(
        eq(inventoryLocations.id, locationId),
        eq(inventoryLocations.company_id, companyId)
      ))
      .limit(1);
    return location ?? null;
  }
}

export const qrcodeService = new QRCodeService();
export default qrcodeService;

