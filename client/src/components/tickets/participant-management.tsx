import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ParticipantSearch } from './participant-search';
import { ParticipantList } from './participant-list';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, UserMinus, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/i18n';

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  company_id?: number;
  avatar_url?: string;
}

interface TicketParticipant {
  id: number;
  ticket_id: number;
  user_id: number;
  added_by_id: number;
  added_at: string;
  user?: User;
  added_by?: User;
}

interface ParticipantHistory {
  id: number;
  ticket_id: number;
  user_id: number;
  action: 'added' | 'removed';
  performed_by_id: number;
  performed_at: string;
  user?: User;
  performed_by?: User;
}

interface ParticipantManagementProps {
  ticketId: number;
  ticketCompanyId?: number;
  ticketCreatorId?: number;
}

export const ParticipantManagement: React.FC<ParticipantManagementProps> = ({ 
  ticketId, 
  ticketCompanyId,
  ticketCreatorId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatMessage } = useI18n();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  // Buscar participantes atuais
  const { data: participantsResponse, isLoading: participantsLoading } = useQuery({
    queryKey: [`/api/ticket-participants/${ticketId}`],
    queryFn: async () => {
      const response = await fetch(`/api/ticket-participants/${ticketId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return { data: [] };
        }
        throw new Error('Falha ao carregar participantes');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  // Garantir que participants seja sempre um array
  const participants = Array.isArray(participantsResponse) ? participantsResponse : 
                     (participantsResponse?.data && Array.isArray(participantsResponse.data)) ? participantsResponse.data : [];

  // Buscar histórico de participantes (se disponível)
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: [`/api/ticket-participants/${ticketId}/history`],
    queryFn: async () => {
      const response = await fetch(`/api/ticket-participants/${ticketId}/history`);
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Falha ao carregar histórico');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutação para adicionar participantes
  const addParticipantsMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const response = await fetch(`/api/ticket-participants/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao adicionar participantes');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Participantes adicionados",
        description: `${data.data.added.length} participantes foram adicionados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/ticket-participants/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ticket-participants/${ticketId}/history`] });
      setIsAddDialogOpen(false);
      setSelectedUsers([]);
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar participantes",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutação para remover participantes
  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/ticket-participants/${ticketId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Falha ao remover participante');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Participante removido",
        description: "Participante foi removido com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/ticket-participants/${ticketId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ticket-participants/${ticketId}/history`] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover participante",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Verificar permissões
  const canManageParticipants = user?.role && (
    ['admin', 'company_admin', 'manager', 'supervisor', 'support'].includes(user.role) ||
    (user.role === 'customer' && user.id === ticketCreatorId) // Cliente criador do ticket pode adicionar participantes
  );
  const isParticipant = Array.isArray(participants) && participants.some((p: any) => p.user_id === user?.id);

  // 🔥 FASE 5.1: Verificar se o usuário pode remover um participante específico
  const canRemoveParticipant = (participantUserId: number) => {
    if (!user?.id) return false;
    
    // Admin e roles de gestão sempre podem remover
    const adminRoles = ['admin', 'company_admin', 'manager', 'supervisor', 'support'];
    if (adminRoles.includes(user.role)) return true;
    
    // Participantes podem se remover da lista
    if (user.id === participantUserId) return true;
    
    // Criador do ticket pode remover participantes
    if (user.role === 'customer' && user.id === ticketCreatorId) return true;
    
    // Participantes podem remover outros participantes
    if (isParticipant) return true;
    
    return false;
  };

  const handleAddParticipants = () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "Nenhum usuário selecionado",
        description: "Selecione pelo menos um usuário para adicionar.",
        variant: "destructive",
      });
      return;
    }

    const userIds = selectedUsers.map(u => u.id);
    addParticipantsMutation.mutate(userIds);
  };

  const handleRemoveParticipant = (userId: number) => {
    // 🔥 FASE 5.1: Verificar permissão antes de tentar remover
    if (!canRemoveParticipant(userId)) {
      toast({
        title: "Permissão negada",
        description: "Você não tem permissão para remover este participante.",
        variant: "destructive",
      });
      return;
    }

    removeParticipantMutation.mutate(userId);
  };

  const participantsData = participants;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {formatMessage('participants.title')} ({Array.isArray(participantsData) ? participantsData.length : 0})
          </CardTitle>
          
          {canManageParticipants && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {formatMessage('participants.add')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{formatMessage('participants.add_participants')}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <ParticipantSearch
                    selectedUsers={selectedUsers}
                    onSelectionChange={setSelectedUsers}
                    placeholder={formatMessage('participants.select_participants')}
                    excludeUserIds={Array.isArray(participantsData) ? participantsData.map((p: any) => p.user_id) : []}
                    ticketCompanyId={ticketCompanyId}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      {formatMessage('participants.cancel')}
                    </Button>
                    <Button
                      onClick={handleAddParticipants}
                      disabled={addParticipantsMutation.isPending || selectedUsers.length === 0}
                    >
                      {addParticipantsMutation.isPending ? formatMessage('participants.adding') : formatMessage('participants.add')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Lista de participantes atuais */}
        {participantsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (Array.isArray(participantsData) && participantsData.length > 0) ? (
          <div className="space-y-2">
            {participantsData.map((participant: TicketParticipant) => (
              <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={participant.user?.avatar_url || ""} alt={participant.user?.name || ""} />
                    <AvatarFallback>
                      {participant.user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">
                      {participant.user?.name || 'Usuário'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {participant.user?.email || 'Email não informado'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatMessage('participants.added_by')} {participant.added_by?.name || formatMessage('participants.system')} em {formatDate(participant.added_at, locale)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {canRemoveParticipant(participant.user_id) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{formatMessage('participants.remove_participant')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {participant.user_id === user?.id ? (
                              <>
                                {formatMessage('participants.confirm_leave')}
                                {formatMessage('participants.leave_warning')}
                              </>
                            ) : (
                              <>
                                {formatMessage('participants.confirm_remove', { name: participant.user?.name || 'este participante' })}
                                {formatMessage('participants.remove_warning')}
                              </>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{formatMessage('participants.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveParticipant(participant.user_id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {participant.user_id === user?.id ? formatMessage('participants.leave') : formatMessage('participants.remove')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>{formatMessage('participants.no_participants')}</p>
            <p className="text-sm">{formatMessage('participants.add_participants_description')}</p>
          </div>
        )}

        {/* Histórico de participantes */}
        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {formatMessage('participants.participant_history')}
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.map((item: ParticipantHistory) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <Badge 
                    variant={item.action === 'added' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {item.action === 'added' ? formatMessage('participants.added') : formatMessage('participants.removed')}
                  </Badge>
                  <span className="font-medium">{item.user?.name || 'Usuário'}</span>
                  <span className="text-gray-500">{formatMessage('participants.by')} {item.performed_by?.name || formatMessage('participants.system')}</span>
                  <span className="text-gray-400 text-xs">
                    {formatDate(item.performed_at, locale)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aviso para participantes */}
        {isParticipant && !canManageParticipants && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{formatMessage('participants.you_are_participant')}</span>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              {formatMessage('participants.participant_description')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 