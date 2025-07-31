import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, CalendarIcon, Filter, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketReport {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  department: {
    id: number;
    name: string;
  };
  customer: {
    id: number;
    name: string;
    email: string;
  };
  assigned_to: {
    id: number;
    name: string;
    email: string;
  } | null;
}

interface ReportStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

export default function TicketReports() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const setSearchParams = (params: URLSearchParams) => {
    const newSearch = params.toString();
    setLocation(newSearch ? `?${newSearch}` : '');
  };
  const [tickets, setTickets] = useState<TicketReport[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    departmentId: searchParams.get('departmentId') || ''
  });

  useEffect(() => {
    fetchReports();
  }, [dateRange, filters]);

  // Sincronizar filtros com URL quando o componente montar
  useEffect(() => {
    const newFilters = {
      status: searchParams.get('status') || '',
      priority: searchParams.get('priority') || '',
      departmentId: searchParams.get('departmentId') || ''
    };
    setFilters(newFilters);
    
    const fromDate = searchParams.get('startDate');
    const toDate = searchParams.get('endDate');
    if (fromDate) {
      setDateRange(prev => ({ ...prev, from: new Date(fromDate) }));
    }
    if (toDate) {
      setDateRange(prev => ({ ...prev, to: new Date(toDate) }));
    }
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (dateRange.from) params.append('startDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) params.append('endDate', format(dateRange.to, 'yyyy-MM-dd'));
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.departmentId) params.append('departmentId', filters.departmentId);

      const response = await fetch(`/api/reports/tickets?${params}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar relatórios');
      }
      const data = await response.json();
      
      setTickets(data.tickets || []);
      setStats(data.stats || { total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      setTickets([]);
      setStats({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
    
    // Atualizar os filtros locais
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    const params = new URLSearchParams(searchParams);
    params.append('format', format);
    
    window.open(`/api/reports/tickets/export?${params}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">Relatório de Tickets</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full lg:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Exportar
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}</>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Prioridade</label>
              <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Departamento</label>
              <Input
                placeholder="ID do departamento"
                value={filters.departmentId}
                onChange={(e) => handleFilterChange('departmentId', e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={fetchReports} disabled={loading}>
              {loading ? 'Carregando...' : 'Aplicar Filtros'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total de Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-sm text-muted-foreground">Abertos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.in_progress}</div>
            <p className="text-sm text-muted-foreground">Em Progresso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-sm text-muted-foreground">Resolvidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.closed}</div>
            <p className="text-sm text-muted-foreground">Fechados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum ticket encontrado com os filtros aplicados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Atribuído a</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Resolvido em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono">{ticket.id}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.title}</TableCell>
                    <TableCell>{ticket.customer?.name || 'N/A'}</TableCell>
                    <TableCell>{ticket.department?.name || 'N/A'}</TableCell>
                    <TableCell>{ticket.assigned_to?.name || 'Não atribuído'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(ticket.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      {ticket.resolved_at ? format(new Date(ticket.resolved_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}