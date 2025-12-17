import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';

// Configuração do cliente S3/Wasabi
const s3Client = new S3Client({
  region: process.env.WASABI_REGION || 'us-east-1',
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID!,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Necessário para compatibilidade com Wasabi
});

const BUCKET_NAME = process.env.WASABI_BUCKET_NAME || 'gestao-tickets-anexos';
const URL_EXPIRATION = parseInt(process.env.FILE_URL_EXPIRATION || '3600'); // 1 hora
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,rtf,xls,xlsx,csv,ppt,pptx,sql,db,sqlite,jpg,jpeg,png,gif,bmp,tiff,svg,webp,zip,rar,7z,tar,gz,json,xml,yaml,yml,log,ini,cfg,conf,exe,msi,deb,rpm,mp4,avi,mov,wmv,flv,webm,mp3,wav,flac,aac').split(',');

// Interface para o resultado do upload
export interface UploadResult {
  s3Key: string;
  bucket: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

// Interface para dados do arquivo
export interface FileData {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

interface InventoryUploadParams {
  buffer: Buffer;
  originalName: string;
  companyId: number;
  folder?: string;
  mimeType?: string;
  metadata?: Record<string, string | number | boolean | undefined | null>;
}

class S3Service {
  /**
   * Valida se o arquivo é permitido
   */
  validateFile(file: FileData): { valid: boolean; error?: string } {
    // Verificar tamanho
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`
      };
    }

    // Verificar tipo de arquivo pela extensão
    const extension = path.extname(file.originalName).toLowerCase().replace('.', '');
    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      return {
        valid: false,
        error: `Tipo de arquivo não permitido. Tipos aceitos: ${ALLOWED_FILE_TYPES.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Sanitiza nomes de arquivos removendo acentos, espaços e caracteres especiais
   */
  sanitizeFileName(name: string): string {
    return name
      .normalize('NFD') // Normalizar acentos
      .replace(/[\u0300-\u036f]/g, '') // Remover diacríticos
      .replace(/ç/g, 'c').replace(/Ç/g, 'C') // Cedilha
      .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Substituir tudo que não for letra, número, - _ . por _
      .replace(/_{2,}/g, '_') // Múltiplos _ por um só
      .replace(/^_+|_+$/g, '') // Remover _ do início/fim
      .substring(0, 80); // Limitar tamanho
  }

  /**
   * Gera uma chave única para o arquivo no S3
   */
  generateS3Key(originalFilename: string, ticketId: number, userId: number): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension);
    
    // Sanitizar nome do arquivo
    const sanitizedBaseName = this.sanitizeFileName(baseName);
    const sanitizedExtension = this.sanitizeFileName(extension);

    const s3Key = `tickets/${ticketId}/attachments/${userId}/${timestamp}_${randomId}_${sanitizedBaseName}${sanitizedExtension}`;
    
    return s3Key;
  }

  /**
   * Faz upload de um arquivo para o S3/Wasabi
   */
  async uploadFile(file: FileData, ticketId: number, userId: number): Promise<UploadResult> {
    // Validar arquivo
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Gerar chave S3 e nome sanitizado
    const s3Key = this.generateS3Key(file.originalName, ticketId, userId);
    const filename = path.basename(s3Key);
    const sanitizedOriginalName = this.sanitizeFileName(file.originalName);

    try {
      // Comando de upload
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          'original-filename': sanitizedOriginalName,
          'ticket-id': ticketId.toString(),
          'uploaded-by': userId.toString(),
          'upload-timestamp': Date.now().toString(),
        },
      });

      // Executar upload
      await s3Client.send(uploadCommand);

      return {
        s3Key,
        bucket: BUCKET_NAME,
        filename,
        originalFilename: sanitizedOriginalName,
        fileSize: file.size,
        mimeType: file.mimeType,
      };

    } catch (error) {
      console.error(`[S3] ❌ Erro no upload:`, error);
      throw new Error('Falha ao fazer upload do arquivo. Tente novamente.');
    }
  }

  private generateInventoryKey(originalFilename: string, companyId: number, folder: string) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename) || '.bin';
    const baseName = path.basename(originalFilename, extension);

    const sanitizedBaseName = this.sanitizeFileName(baseName);
    const sanitizedExtension = this.sanitizeFileName(extension);

    return `inventory/${companyId}/${folder}/${timestamp}_${randomId}_${sanitizedBaseName}${sanitizedExtension}`;
  }

  /**
   * Upload genérico para arquivos de inventário (NF-e, termos, etc)
   */
  async uploadInventoryFile(params: InventoryUploadParams): Promise<UploadResult> {
    const folder = params.folder || 'general';
    const mimeType = params.mimeType || 'application/octet-stream';

    const fileData: FileData = {
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType,
      size: params.buffer.length,
    };

    const validation = this.validateFile({ ...fileData, originalName: `${params.originalName}` });
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const sanitizedOriginalName = this.sanitizeFileName(params.originalName);
    const s3Key = this.generateInventoryKey(sanitizedOriginalName, params.companyId, folder);
    const filename = path.basename(s3Key);

    const metadataEntries = Object.entries(params.metadata || {}).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) return acc;
      acc[key] = String(value);
      return acc;
    }, {});

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: params.buffer,
        ContentType: mimeType,
        Metadata: {
          'original-filename': sanitizedOriginalName,
          'company-id': params.companyId.toString(),
          ...metadataEntries,
        },
      });

      await s3Client.send(uploadCommand);

      return {
        s3Key,
        bucket: BUCKET_NAME,
        filename,
        originalFilename: sanitizedOriginalName,
        fileSize: params.buffer.length,
        mimeType,
      };
    } catch (error) {
      console.error('[S3] ❌ Erro no upload de inventário:', error);
      throw new Error('Falha ao fazer upload do arquivo de inventário. Tente novamente.');
    }
  }

  /**
   * Upload específico para PDFs assinados de termos de responsabilidade
   */
  async uploadSignedTermPdf(params: {
    buffer: Buffer;
    termId: number;
    companyId: number;
    mimeType?: string;
  }): Promise<UploadResult> {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const s3Key = `inventory/${params.companyId}/signed-terms/${params.termId}_${timestamp}_${randomId}_signed.pdf`;
    const filename = path.basename(s3Key);
    const mimeType = params.mimeType || 'application/pdf';

    const fileData: FileData = {
      buffer: params.buffer,
      originalName: `termo-assinado-${params.termId}.pdf`,
      mimeType,
      size: params.buffer.length,
    };

    const validation = this.validateFile(fileData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: params.buffer,
        ContentType: mimeType,
        Metadata: {
          'original-filename': `termo-assinado-${params.termId}.pdf`,
          'company-id': params.companyId.toString(),
          'term-id': params.termId.toString(),
          'signed-at': new Date().toISOString(),
        },
      });

      await s3Client.send(uploadCommand);

      return {
        s3Key,
        bucket: BUCKET_NAME,
        filename,
        originalFilename: `termo-assinado-${params.termId}.pdf`,
        fileSize: params.buffer.length,
        mimeType,
      };
    } catch (error) {
      console.error('[S3] ❌ Erro no upload de PDF assinado:', error);
      throw new Error('Falha ao fazer upload do PDF assinado. Tente novamente.');
    }
  }

  /**
   * Gera URL assinada para download de arquivo
   */
  async getDownloadUrl(s3Key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: URL_EXPIRATION,
      });

      return signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL de download:', error);
      throw new Error('Falha ao gerar URL de download.');
    }
  }

  /**
   * Remove arquivo do S3/Wasabi (física)
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      });

      await s3Client.send(deleteCommand);
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      throw new Error('Falha ao deletar arquivo.');
    }
  }

  /**
   * Verifica se as configurações do S3/Wasabi estão válidas
   */
  async testConnection(): Promise<{ success: boolean; error?: string; diagnostics?: any }> {
    try {
      // Configurações básicas
      const config = {
        accessKey: process.env.WASABI_ACCESS_KEY_ID ? 'Configurado' : 'AUSENTE',
        secretKey: process.env.WASABI_SECRET_ACCESS_KEY ? 'Configurado' : 'AUSENTE',
        region: process.env.WASABI_REGION || 'us-east-1',
        endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
        bucket: BUCKET_NAME,
        timestamp: new Date().toISOString()
      };

      // Upload de teste
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const testContent = 'teste de conexão - sistema de tickets';
      
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
        Metadata: {
          'test': 'connection',
          'timestamp': Date.now().toString()
        }
      });

      await s3Client.send(uploadCommand);

      // Verificar se o arquivo foi salvo
      const downloadCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      });

      await s3Client.send(downloadCommand);

      // Remover arquivo de teste
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      });

      await s3Client.send(deleteCommand);
      
      return { 
        success: true, 
        diagnostics: {
          ...config,
          testCompleted: true,
          operationsSuccessful: ['upload', 'download', 'delete']
        }
      };
    } catch (error) {
      const diagnostics = {
        accessKey: process.env.WASABI_ACCESS_KEY_ID ? 'Configurado' : 'AUSENTE',
        secretKey: process.env.WASABI_SECRET_ACCESS_KEY ? 'Configurado' : 'AUSENTE',
        region: process.env.WASABI_REGION || 'us-east-1',
        endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
        bucket: BUCKET_NAME,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
        possibleCauses: [] as string[]
      };

      // Diagnóstico específico para diferentes tipos de erro
      if (error instanceof Error && error.message.includes('SignatureDoesNotMatch')) {
        diagnostics.possibleCauses = [
          'Credenciais AWS/Wasabi incorretas ou expiradas',
          'Relógio do servidor desalinhado (verificar fuso horário)',
          'Endpoint Wasabi incorreto',
          'Região configurada incorretamente',
          'Bucket não existe ou sem permissões'
        ];
      } else if (error instanceof Error && error.message.includes('NoSuchBucket')) {
        diagnostics.possibleCauses = [
          'Bucket não existe',
          'Nome do bucket incorreto',
          'Bucket em região diferente'
        ];
      } else if (error instanceof Error && error.message.includes('AccessDenied')) {
        diagnostics.possibleCauses = [
          'Credenciais sem permissões suficientes',
          'Política do bucket restritiva',
          'Credenciais incorretas'
        ];
      } else {
        diagnostics.possibleCauses = [
          'Problema de conectividade de rede',
          'Endpoint Wasabi inacessível',
          'Configurações de proxy/firewall'
        ];
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        diagnostics
      };
    }
  }
}

export const s3Service = new S3Service();
export default s3Service; 