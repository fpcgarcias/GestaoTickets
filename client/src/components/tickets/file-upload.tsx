import React, { useState, useCallback, useRef } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';

interface FileUploadProps {
  ticketId: number;
  onUploadSuccess?: (attachment: any) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number; // em bytes
  allowedTypes?: string[];
  disabled?: boolean;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export function FileUpload({ 
  ticketId, 
  onUploadSuccess, 
  onUploadError,
  maxFileSize = 50 * 1024 * 1024, // 50MB padrão
  allowedTypes = [
    // Documentos
    'pdf', 'doc', 'docx', 'txt', 'rtf',
    // Planilhas
    'xls', 'xlsx', 'csv',
    // Apresentações
    'ppt', 'pptx',
    // Banco de dados e scripts
    'sql', 'db', 'sqlite',
    // Imagens
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg', 'webp',
    // Arquivos compactados
    'zip', 'rar', '7z', 'tar', 'gz',
    // Outros formatos úteis
    'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'cfg', 'conf',
    // Executáveis e instaladores
    'exe', 'msi', 'deb', 'rpm',
    // Vídeos (formatos comuns)
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm',
    // Áudio
    'mp3', 'wav', 'flac', 'aac'
  ],
  disabled = false
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const { toast } = useToast();
  const { formatMessage } = useI18n();

  // Ref para o input file
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Verificar tamanho
    if (file.size > maxFileSize) {
      return formatMessage('file_upload.file_too_large', { maxSize: Math.round(maxFileSize / 1024 / 1024) });
    }

    // Verificar tipo
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedTypes.includes(extension)) {
      return formatMessage('file_upload.file_type_not_allowed', { types: allowedTypes.join(', ') });
    }

    return null;
  }, [maxFileSize, allowedTypes, formatMessage]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = formatMessage('file_upload.unexpected_error');
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (jsonErr) {
          // Se não for JSON, pode ser HTML ou texto
          if (text && text.includes('Tipo de arquivo não permitido')) {
            errorMessage = formatMessage('file_upload.file_type_not_allowed_retry');
          } else if (text && text.includes('Payload Too Large')) {
            errorMessage = formatMessage('file_upload.file_too_large_exceeded');
          } else {
            errorMessage = formatMessage('file_upload.unexpected_error');
          }
        }
        throw new Error(errorMessage);
      }

      const attachment = await response.json();
      return attachment;
    } catch (error) {
      throw error;
    }
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    // Validar arquivos
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        toast({
          title: formatMessage('file_upload.invalid_file'),
          description: `${file.name}: ${error}`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Inicializar estado de upload
    const newUploadingFiles = validFiles.map(file => ({
      file,
      progress: 0
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload dos arquivos
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      try {
        // Simular progresso (já que não temos progress real do fetch)
        const updateProgress = (progress: number) => {
          setUploadingFiles(prev => 
            prev.map(uf => 
              uf.file === file ? { ...uf, progress } : uf
            )
          );
        };

        updateProgress(25);
        const attachment = await uploadFile(file);
        updateProgress(100);

        // Remover da lista de upload
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
        }, 1000);

        // Chamar callback de sucesso
        onUploadSuccess?.(attachment);

        toast({
          title: formatMessage('file_upload.upload_completed'),
          description: formatMessage('file_upload.upload_success', { filename: file.name }),
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : formatMessage('file_upload.upload_error');
        
        // Marcar erro no arquivo
        setUploadingFiles(prev => 
          prev.map(uf => 
            uf.file === file ? { ...uf, error: errorMessage, progress: 0 } : uf
          )
        );

        onUploadError?.(errorMessage);

        toast({
          title: formatMessage('file_upload.upload_error'),
          description: `${file.name}: ${errorMessage}`,
          variant: "destructive",
        });
      }
    }
  }, [ticketId, validateFile, uploadFile, onUploadSuccess, onUploadError, disabled, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFiles(files);
  }, [handleFiles, disabled]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
    // Limpar input para permitir reenvio do mesmo arquivo
    e.target.value = '';
  }, [handleFiles]);

  const removeUploadingFile = useCallback((file: File) => {
    setUploadingFiles(prev => prev.filter(uf => uf.file !== file));
  }, []);

  // Permitir clique em toda a área do Card
  const handleCardClick = (e: React.MouseEvent) => {
    // Evitar conflito com drag-and-drop
    if (disabled || (e.target as HTMLElement).tagName === 'INPUT') return;
    inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Área de Upload */}
      <Card
        className={`
          relative border-2 border-dashed transition-colors cursor-pointer
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleCardClick}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-disabled={disabled}
      >
        <div className="p-8 text-center">
          <Upload className={`mx-auto h-12 w-12 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
          <div className="mt-4">
            <span className="text-lg font-medium text-gray-900">
              {formatMessage('file_upload.drag_or_click')}
            </span>
            <input
              ref={inputRef}
              id="file-upload"
              type="file"
              multiple
              disabled={disabled}
              onChange={handleFileSelect}
              className="hidden"
              accept={allowedTypes.map(type => `.${type}`).join(',')}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {formatMessage('file_upload.max_size')} 
            {formatMessage('file_upload.accepted_types')} {allowedTypes.join(', ')}
          </p>
        </div>
      </Card>

      {/* Lista de Arquivos Sendo Enviados */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">{formatMessage('file_upload.uploading_files')}</h4>
          {uploadingFiles.map(({ file, progress, error }, index) => (
            <Card key={`${file.name}-${index}`} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {error ? (
                    <div className="flex items-center space-x-1 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs">{formatMessage('file_upload.error')}</span>
                    </div>
                  ) : progress === 100 ? (
                    <span className="text-xs text-green-600">{formatMessage('file_upload.completed')}</span>
                  ) : (
                    <span className="text-xs text-blue-600">{progress}%</span>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadingFile(file)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Barra de Progresso */}
              {!error && progress < 100 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div 
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Erro */}
              {error && (
                <div className="mt-2">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 