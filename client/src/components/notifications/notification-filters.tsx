import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { NotificationFilters as FilterType } from '@/hooks/use-notifications';

interface NotificationFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onClearFilters: () => void;
}

/**
 * NotificationFilters - Componente de filtros para notificações
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 * 
 * Funcionalidades:
 * - Dropdown para filtrar por tipo
 * - Dropdown para filtrar por status de leitura
 * - Date range picker para filtrar por período
 * - Campo de busca textual
 */
export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const hasActiveFilters = 
    filters.type || 
    filters.read !== undefined || 
    filters.startDate || 
    filters.endDate || 
    filters.search;

  const handleTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      type: value === 'all' ? undefined : value,
    });
  };

  const handleReadStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      read: value === 'all' ? undefined : value === 'read',
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value || undefined,
    });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      startDate: date,
    });
  };

  const handleEndDateChange = (date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      endDate: date,
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium text-sm">Filtros</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 gap-1"
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filtro por tipo (Requirement 8.1) */}
        <div className="space-y-2">
          <Label htmlFor="type-filter" className="text-xs">
            Tipo de Notificação
          </Label>
          <Select
            value={filters.type || 'all'}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger id="type-filter" className="h-9">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="new_ticket">Novo Ticket</SelectItem>
              <SelectItem value="status_change">Mudança de Status</SelectItem>
              <SelectItem value="new_reply">Nova Resposta</SelectItem>
              <SelectItem value="participant_added">Participante Adicionado</SelectItem>
              <SelectItem value="participant_removed">Participante Removido</SelectItem>
              <SelectItem value="ticket_escalated">Ticket Escalado</SelectItem>
              <SelectItem value="ticket_due_soon">Ticket Vencendo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por status de leitura (Requirement 8.2) */}
        <div className="space-y-2">
          <Label htmlFor="read-filter" className="text-xs">
            Status de Leitura
          </Label>
          <Select
            value={
              filters.read === undefined
                ? 'all'
                : filters.read
                ? 'read'
                : 'unread'
            }
            onValueChange={handleReadStatusChange}
          >
            <SelectTrigger id="read-filter" className="h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Não lidas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtro por período de datas (Requirement 8.3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Data Inicial</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full h-9 justify-start text-left font-normal',
                  !filters.startDate && 'text-muted-foreground'
                )}
              >
                {filters.startDate ? (
                  format(filters.startDate, 'dd/MM/yyyy', { locale: ptBR })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.startDate}
                onSelect={handleStartDateChange}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Data Final</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full h-9 justify-start text-left font-normal',
                  !filters.endDate && 'text-muted-foreground'
                )}
              >
                {filters.endDate ? (
                  format(filters.endDate, 'dd/MM/yyyy', { locale: ptBR })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.endDate}
                onSelect={handleEndDateChange}
                initialFocus
                locale={ptBR}
                disabled={(date) =>
                  filters.startDate ? date < filters.startDate : false
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Busca textual (Requirement 8.4) */}
      <div className="space-y-2">
        <Label htmlFor="search-filter" className="text-xs">
          Buscar por texto
        </Label>
        <Input
          id="search-filter"
          type="text"
          placeholder="Buscar em título ou mensagem..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="h-9"
        />
      </div>
    </div>
  );
};
