import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBusinessHoursRefetchInterval } from '../hooks/use-business-hours';
import { 
  Loader2, 
  Bell, 
  Calendar, 
  PlayCircle, 
  StopCircle, 
  RotateCcw, 
  AlertTriangle,
  Settings,
  TrendingUp,
  Clock
} from 'lucide-react';

interface SchedulerStatus {
  isRunning: boolean;
  message: string;
}

interface MaintenanceNotification {
  maintenance_start: string;
  maintenance_end: string;
  message: string;
  company_id?: number;
}

interface _EscalateTicket {
  reason: string;
}

const AdvancedNotificationSettings: React.FC = () => {
  const { toast } = useToast();
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceNotification>({
    maintenance_start: '',
    maintenance_end: '',
    message: '',
    company_id: undefined
  });
  const [escalateTicketId, setEscalateTicketId] = useState('');
  const [escalateReason, setEscalateReason] = useState('');

  // Usar hook dinâmico para horário comercial
  const refetchInterval = useBusinessHoursRefetchInterval(10000);

  // Query para verificar status do scheduler
  const { data: schedulerStatus, refetch: refetchStatus } = useQuery<SchedulerStatus>({
    queryKey: ['scheduler-status'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/scheduler/status');
      if (!response.ok) {
        throw new Error('Erro ao verificar status do scheduler');
      }
      return response.json();
    },
    // Atualizar apenas entre 6h e 21h (horário comercial) - dinâmico
    refetchInterval: refetchInterval,
  });

  // Mutations para controle do scheduler
  const startSchedulerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/scheduler/start', { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao iniciar scheduler');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Scheduler iniciado com sucesso!" });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/scheduler/stop', { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao parar scheduler');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Scheduler parado com sucesso!" });
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const manualCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/scheduler/check-now', { method: 'POST' });
      if (!response.ok) throw new Error('Erro ao executar verificação');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Verificação manual executada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para notificação de manutenção
  const maintenanceMutation = useMutation({
    mutationFn: async (data: MaintenanceNotification) => {
      const response = await fetch('/api/notifications/system-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao enviar notificação de manutenção');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Notificação de manutenção enviada!" });
      setMaintenanceForm({
        maintenance_start: '',
        maintenance_end: '',
        message: '',
        company_id: undefined
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Mutation para escalação manual
  const escalateMutation = useMutation({
    mutationFn: async ({ ticketId, reason }: { ticketId: string; reason: string }) => {
      const response = await fetch(`/api/notifications/escalate-ticket/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Erro ao escalar ticket');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Ticket escalado com sucesso!" });
      setEscalateTicketId('');
      setEscalateReason('');
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleSendMaintenance = () => {
    if (!maintenanceForm.maintenance_start || !maintenanceForm.maintenance_end || !maintenanceForm.message) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    maintenanceMutation.mutate(maintenanceForm);
  };

  const handleEscalateTicket = () => {
    if (!escalateTicketId || !escalateReason) {
      toast({
        title: "Erro",
        description: "Preencha o ID do ticket e o motivo",
        variant: "destructive"
      });
      return;
    }

    escalateMutation.mutate({ ticketId: escalateTicketId, reason: escalateReason });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sistema de Notificações Avançado</h2>
        <p className="text-muted-foreground">
          Controle e configure o sistema automático de notificações por email
        </p>
      </div>

      {/* Status do Scheduler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status do Scheduler Automático
          </CardTitle>
          <CardDescription>
            O scheduler verifica automaticamente tickets próximos do vencimento a cada hora
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant={schedulerStatus?.isRunning ? "default" : "secondary"}>
                {schedulerStatus?.isRunning ? "Rodando" : "Parado"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {schedulerStatus?.message}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => startSchedulerMutation.mutate()}
                disabled={schedulerStatus?.isRunning || startSchedulerMutation.isPending}
                size="sm"
                variant="outline"
              >
                {startSchedulerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Iniciar
              </Button>
              <Button
                onClick={() => stopSchedulerMutation.mutate()}
                disabled={!schedulerStatus?.isRunning || stopSchedulerMutation.isPending}
                size="sm"
                variant="outline"
              >
                {stopSchedulerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="h-4 w-4" />
                )}
                Parar
              </Button>
              <Button
                onClick={() => manualCheckMutation.mutate()}
                disabled={manualCheckMutation.isPending}
                size="sm"
                variant="outline"
              >
                {manualCheckMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Verificar Agora
              </Button>
            </div>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Funcionalidades automáticas:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
              <li>• Verifica tickets próximos do vencimento baseado no SLA real</li>
              <li>• Críticos: notifica quando restar 25% do tempo (mín. 1h)</li>
              <li>• Altos: notifica quando restar 20% do tempo (mín. 2h)</li>
              <li>• Médios: notifica quando restar 15% do tempo (mín. 3h)</li>
              <li>• Baixos: notifica quando restar 10% do tempo (mín. 4h)</li>
              <li>• Escala automaticamente tickets que violaram SLA</li>
              <li>• Notifica atendentes e supervisores sobre prazos</li>
              <li>• Executa a cada hora durante funcionamento do servidor</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Notificação de Manutenção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Notificação de Manutenção do Sistema
          </CardTitle>
          <CardDescription>
            Envie avisos sobre manutenções programadas para todos os usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maintenance_start">Data/Hora de Início</Label>
              <Input
                id="maintenance_start"
                type="datetime-local"
                value={maintenanceForm.maintenance_start}
                onChange={(e) => setMaintenanceForm(prev => ({
                  ...prev,
                  maintenance_start: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="maintenance_end">Data/Hora de Fim</Label>
              <Input
                id="maintenance_end"
                type="datetime-local"
                value={maintenanceForm.maintenance_end}
                onChange={(e) => setMaintenanceForm(prev => ({
                  ...prev,
                  maintenance_end: e.target.value
                }))}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="maintenance_message">Mensagem da Manutenção</Label>
            <Textarea
              id="maintenance_message"
              placeholder="Descreva o motivo da manutenção, tempo estimado, impactos esperados..."
              value={maintenanceForm.message}
              onChange={(e) => setMaintenanceForm(prev => ({
                ...prev,
                message: e.target.value
              }))}
            />
          </div>

          <div>
            <Label htmlFor="company_id">ID da Empresa (opcional)</Label>
            <Input
              id="company_id"
              type="number"
              placeholder="Deixe vazio para notificar todas as empresas"
              value={maintenanceForm.company_id || ''}
              onChange={(e) => setMaintenanceForm(prev => ({
                ...prev,
                company_id: e.target.value ? parseInt(e.target.value) : undefined
              }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se não especificado, enviará para todos os usuários ativos do sistema
            </p>
          </div>

          <Button 
            onClick={handleSendMaintenance}
            disabled={maintenanceMutation.isPending}
            className="w-full"
          >
            {maintenanceMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            Enviar Notificação de Manutenção
          </Button>
        </CardContent>
      </Card>

      {/* Escalação Manual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Escalação Manual de Ticket
          </CardTitle>
          <CardDescription>
            Force a escalação de um ticket específico com notificação imediata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ticket_id">ID do Ticket</Label>
            <Input
              id="ticket_id"
              type="number"
              placeholder="Digite o ID do ticket"
              value={escalateTicketId}
              onChange={(e) => setEscalateTicketId(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="escalate_reason">Motivo da Escalação</Label>
            <Textarea
              id="escalate_reason"
              placeholder="Explique o motivo da escalação manual..."
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleEscalateTicket}
            disabled={escalateMutation.isPending}
            className="w-full"
            variant="outline"
          >
            {escalateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            Escalar Ticket
          </Button>
        </CardContent>
      </Card>

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tipos de Notificação Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Notificações de Tickets:</h4>
              <ul className="text-sm space-y-1">
                <li>✓ Novo ticket criado</li>
                <li>✓ Ticket atribuído</li>
                <li>✓ Nova resposta recebida</li>
                <li>✓ Status alterado</li>
                <li>✓ Ticket escalado</li>
                <li>✓ Vencimento próximo</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Notificações Administrativas:</h4>
              <ul className="text-sm space-y-1">
                <li>✓ Novo solicitante registrado</li>
                <li>✓ Novo usuário criado</li>
                <li>✓ Manutenção do sistema</li>
                <li>✓ Escalação automática por SLA</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedNotificationSettings; 