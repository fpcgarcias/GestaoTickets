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
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,txt,jpg,jpeg,png,gif,zip,rar').split(',');

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
   * Gera uma chave única para o arquivo no S3
   */
  generateS3Key(originalFilename: string, ticketId: number, userId: number): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension);
    
    // Sanitizar nome do arquivo
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);

    return `tickets/${ticketId}/attachments/${userId}/${timestamp}_${randomId}_${sanitizedBaseName}${extension}`;
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

    // Gerar chave S3
    const s3Key = this.generateS3Key(file.originalName, ticketId, userId);
    
    // Gerar nome do arquivo (sem caracteres especiais)
    const filename = path.basename(s3Key);

    try {
      // Comando de upload
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          'original-filename': file.originalName,
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
        originalFilename: file.originalName,
        fileSize: file.size,
        mimeType: file.mimeType,
      };

    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      throw new Error('Falha ao fazer upload do arquivo. Tente novamente.');
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
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Tentar fazer um pequeno upload de teste
      const testKey = `test/connection-test-${Date.now()}.txt`;
      const testContent = 'teste de conexão';
      
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
      });

      await s3Client.send(uploadCommand);

      // Remover arquivo de teste
      const deleteCommand = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      });

      await s3Client.send(deleteCommand);

      return { success: true };
    } catch (error) {
      console.error('Erro ao testar conexão S3:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}

export const s3Service = new S3Service();
export default s3Service; 