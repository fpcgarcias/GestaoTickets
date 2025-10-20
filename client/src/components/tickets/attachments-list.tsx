import React, { useState } from 'react';
import { Download, File, FileText, Image, Archive, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TicketAttachment } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

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
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

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

  const canDeleteAttachment = (attachment: Attachment) => {
    if (!user) {
      return false;
    }

    if (['admin', 'company_admin'].includes(user.role)) {
      return true;
    }

    if (['support', 'manager', 'supervisor'].includes(user.role) && attachment.user_id === user.id) {
      return true;
    }

    return false;
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!canDeleteAttachment(attachment)) {
      return;
    }

    const confirmed = window.confirm(`Remover o anexo "${attachment.original_filename}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingIds(prev => {
      const next = new Set(prev);
      next.add(attachment.id);
      return next;
    });

    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody?.message || 'Falha ao remover o anexo.';
        throw new Error(errorMessage);
      }

      toast({
        title: "Anexo removido",
        description: `${attachment.original_filename} foi removido com sucesso.`,
      });

      const result = await fetchAttachments();
      if (result.data) {
        onAttachmentsChange?.(result.data);
      }
    } catch (error) {
      toast({
        title: "Erro ao remover anexo",
        description: error instanceof Error ? error.message : "Não foi possível remover o anexo.",
        variant: "destructive",
      });
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(attachment.id);
        return next;
      });
    }
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-primary" />;
    }
    
    if (['zip', 'rar', '7z'].includes(extension || '')) {
      return <Archive className="h-5 w-5 text-purple-400 dark:text-purple-300" />;
    }
    
    if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="h-5 w-5 text-destructive" />;
    }
    
    return <File className="h-5 w-5 text-muted-foreground" />;
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
          <div className="text-center text-muted-foreground">
            <File className="mx-auto h-12 w-12 text-muted-foreground/60 mb-4" />
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {attachment.original_filename}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(attachment.file_size)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Enviado em {formatDate(attachment.uploaded_at)}
                      </p>
                      {attachment.user && (
                        <p className="text-xs text-muted-foreground">
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
                  {canDeleteAttachment(attachment) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAttachment(attachment)}
                      disabled={deletingIds.has(attachment.id)}
                      className="flex items-center space-x-1 text-destructive hover:text-destructive focus-visible:ring-destructive"
                    >
                      {deletingIds.has(attachment.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {deletingIds.has(attachment.id) ? 'Removendo...' : 'Excluir'}
                      </span>
                      <span className="sr-only">Remover anexo</span>
                    </Button>
                  )}
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
