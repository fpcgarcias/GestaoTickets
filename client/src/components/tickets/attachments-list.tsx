import React, { useState, useEffect } from 'react';
import { Download, File, FileText, Image, Archive, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TicketAttachment } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

// Usar o tipo do schema
type Attachment = TicketAttachment;

interface AttachmentsListProps {
  ticketId: number;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  showUploader?: boolean;
}

const AttachmentsList = React.forwardRef(function AttachmentsList({ 
  ticketId, 
  attachments: initialAttachments, 
  onAttachmentsChange,
  showUploader = false 
}: AttachmentsListProps, ref) {
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Usar React Query para buscar anexos
  const { data: attachments = [], isLoading: loading, refetch: fetchAttachments } = useQuery<Attachment[]>({
    queryKey: [`/api/tickets/${ticketId}/attachments`],
    queryFn: async (): Promise<Attachment[]> => {
      const response = await fetch(`/api/tickets/${ticketId}/attachments`);
      if (!response.ok) {
        throw new Error('Erro ao buscar anexos');
      }
      const data = await response.json();
      onAttachmentsChange?.(data);
      return data;
    },
    initialData: initialAttachments,
    staleTime: 30000, // 30 segundos
  });

  // Expor refetch para uso externo (se necessário)
  React.useImperativeHandle(ref, () => ({ fetchAttachments }), [fetchAttachments]);

  const getFileIcon = (mimeType: string, filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    
    if (['zip', 'rar', '7z'].includes(extension || '')) {
      return <Archive className="h-5 w-5 text-purple-500" />;
    }
    
    if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      setDownloadingIds(prev => new Set(Array.from(prev).concat(attachment.id)));

      // Buscar URL de download
      const response = await fetch(`/api/attachments/${attachment.id}/download`);
      
      if (!response.ok) {
        throw new Error('Erro ao gerar URL de download');
      }

      const { download_url, filename } = await response.json();

      // Criar elemento temporário para download
      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename || attachment.original_filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download iniciado",
        description: `Download de ${attachment.original_filename} iniciado.`,
      });

    } catch (error) {
      console.error('Erro no download:', error);
      toast({
        title: "Erro no download",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(attachment.id);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando anexos...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Anexos 
          {attachments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {attachments.length}
            </Badge>
          )}
        </h3>
      </div>

      {/* Lista de Anexos */}
      {attachments.length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-gray-500">
            <File className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p>Nenhum anexo encontrado</p>
            {showUploader && (
              <p className="text-sm mt-2">Use o formulário acima para adicionar arquivos.</p>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(attachment.mime_type, attachment.original_filename)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.original_filename}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(attachment.file_size)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500">
                        Enviado em {formatDate(attachment.uploaded_at)}
                      </p>
                      {attachment.user && (
                        <p className="text-xs text-gray-500">
                          por {attachment.user.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadAttachment(attachment)}
                    disabled={downloadingIds.has(attachment.id)}
                    className="flex items-center space-x-1"
                  >
                    {downloadingIds.has(attachment.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {downloadingIds.has(attachment.id) ? 'Baixando...' : 'Baixar'}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});

export { AttachmentsList }; 