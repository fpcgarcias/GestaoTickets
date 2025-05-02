import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Plus, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketCard } from '@/components/tickets/ticket-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TICKET_STATUS, PRIORITY_LEVELS } from '@/lib/utils';
import { Ticket } from '@shared/schema';

export default function TicketsIndex() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('this-week');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tickets, isLoading } = useQuery<Ticket[]>({
    queryKey: ['/api/tickets'],
  });

  const filteredTickets = tickets?.filter(ticket => {
    // Apply search filter
    if (searchQuery && !ticket.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Apply status filter
    if (statusFilter !== 'all' && ticket.status !== statusFilter) {
      return false;
    }
    
    // Apply priority filter
    if (priorityFilter && priorityFilter !== 'all' && ticket.priority !== priorityFilter) {
      return false;
    }
    
    // Apply time filter
    if (timeFilter && ticket.createdAt) {
      const ticketDate = new Date(ticket.createdAt);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Início da semana (domingo)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      switch (timeFilter) {
        case 'this-week':
          if (ticketDate < weekStart) return false;
          break;
        case 'last-week':
          const lastWeekStart = new Date(weekStart);
          lastWeekStart.setDate(weekStart.getDate() - 7);
          if (ticketDate < lastWeekStart || ticketDate >= weekStart) return false;
          break;
        case 'this-month':
          if (ticketDate < monthStart) return false;
          break;
        case 'custom':
          // Será implementado com um seletor de data personalizado
          break;
      }
    }
    
    return true;
  });

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Chamados</h1>
        <Button onClick={() => navigate('/tickets/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 h-4 w-4" />
          <Input 
            placeholder="Buscar chamado" 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select
          value={timeFilter}
          onValueChange={setTimeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">Esta Semana</SelectItem>
            <SelectItem value="last-week">Semana Passada</SelectItem>
            <SelectItem value="this-month">Este Mês</SelectItem>
            <SelectItem value="custom">Período Personalizado</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={setPriorityFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecionar Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Prioridades</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.LOW}>Baixa</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.MEDIUM}>Média</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.HIGH}>Alta</SelectItem>
            <SelectItem value={PRIORITY_LEVELS.CRITICAL}>Crítica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Tabs */}
      <Tabs 
        defaultValue="all" 
        value={statusFilter}
        onValueChange={setStatusFilter}
        className="mb-6"
      >
        <TabsList className="border-b border-neutral-200 w-full justify-start rounded-none bg-transparent">
          <TabsTrigger value="all" className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Todos os Chamados
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.NEW} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Novos
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.ONGOING} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Em Andamento
          </TabsTrigger>
          <TabsTrigger value={TICKET_STATUS.RESOLVED} className="px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent data-[state=active]:shadow-none">
            Resolvidos
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status Legend */}
      <div className="mb-6 bg-white p-4 rounded-md border border-neutral-200 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-new mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Novos</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-ongoing mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados em Andamento</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-status-resolved mr-2"></div>
            <span className="text-sm text-neutral-700">Chamados Resolvidos</span>
          </div>
        </div>
      </div>

      {/* Ticket Cards */}
      <div className="space-y-4">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-md border border-neutral-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-10 w-full mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))
        ) : filteredTickets?.length ? (
          filteredTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))
        ) : (
          <div className="bg-white rounded-md border border-neutral-200 p-8 text-center">
            <h3 className="text-lg font-medium text-neutral-700 mb-2">Nenhum chamado encontrado</h3>
            <p className="text-neutral-500 mb-4">
              {searchQuery ? 'Tente ajustar seus termos de busca' : 'Crie seu primeiro chamado para começar'}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/tickets/new">Criar Chamado</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredTickets && filteredTickets.length > 0 && (
        <div className="flex justify-end mt-6">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" className="bg-primary text-white hover:bg-primary/90">1</Button>
            <Button variant="outline" size="sm">2</Button>
            <Button variant="outline" size="sm">Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
