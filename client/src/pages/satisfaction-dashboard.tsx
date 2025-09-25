import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MessageSquare, 
  BarChart3,
  Filter,
  Download,
  Calendar,
  Loader2
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { DateRange } from 'react-day-picker';

interface SatisfactionSurvey {
  id: number;
  ticket_id: number;
  customer_email: string;
  rating: number | null;
  comments: string | null;
  sent_at: string;
  responded_at: string | null;
  status: 'sent' | 'responded' | 'expired';
  expires_at: string;
  ticket?: {
    ticket_id: string;
    title: string;
    department_name: string;
    assigned_official_name: string | null;
  };
}

interface SatisfactionStats {
  total_sent: number;
  total_responded: number;
  response_rate: number;
  average_rating: number;
  ratings_breakdown: {
    [key: number]: number;
  };
  trend: {
    rating_trend: number;
    response_rate_trend: number;
  };
}

interface Department {
  id: number;
  name: string;
  satisfaction_survey_enabled: boolean;
}

interface Official {
  id: number;
  name: string;
}

const SatisfactionDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<SatisfactionSurvey[]>([]);
  const [stats, setStats] = useState<SatisfactionStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  // Remover useState de officials - vamos usar useQuery
  
  // Filtros
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedOfficial, setSelectedOfficial] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRating, setSelectedRating] = useState<string>('all');
  // Estados para filtro de data padrão
  const [timeFilter, setTimeFilter] = useState('this-month');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Função para calcular datas baseada no filtro
  const getPeriodDates = () => {
    const now = new Date();
    let from: Date;
    let to: Date;
    
    switch (timeFilter) {
      case 'this-week':
        from = startOfWeek(now, { weekStartsOn: 1 }); // segunda-feira
        to = endOfWeek(now, { weekStartsOn: 1 }); // domingo
        break;
      case 'last-week': {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        from = startOfWeek(lastWeek, { weekStartsOn: 1 });
        to = endOfWeek(lastWeek, { weekStartsOn: 1 });
        break;
      }
      case 'this-month':
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case 'custom':
        from = dateRange.from || startOfMonth(now);
        to = dateRange.to || endOfMonth(now);
        break;
      default:
        from = startOfMonth(now);
        to = endOfMonth(now);
    }
    return { from, to };
  };

  // Estado de permissões
  const [canViewAllDepartments, setCanViewAllDepartments] = useState(false);
  const [userDepartments, setUserDepartments] = useState<number[]>([]);
  const [showDepartmentFilter, setShowDepartmentFilter] = useState(false);

  // Buscar atendentes usando useQuery (igual ao dashboard principal)
  const { data: officialsResponse, isLoading: isOfficialsLoading } = useQuery({
    queryKey: ['/api/officials', user?.id, user?.role, selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '1000');
      params.append('includeInactive', 'false');
      
      // Se um departamento específico foi selecionado, filtrar por ele
      if (selectedDepartment !== 'all') {
        params.append('department_id', selectedDepartment);
      }
      
      const res = await fetch(`/api/officials?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao carregar atendentes');
      return res.json();
    },
    enabled: !!user && ['admin', 'company_admin', 'manager', 'supervisor'].includes(user.role || ''),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const officials = officialsResponse?.officials || officialsResponse?.data || [];

  // Verificar permissões do usuário
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) return;

      const canViewAll = ['admin', 'company_admin'].includes(user.role);
      setCanViewAllDepartments(canViewAll);

      if (['manager', 'supervisor'].includes(user.role)) {
        // Buscar departamentos do usuário
        try {
          const response = await fetch('/api/officials/me/departments');
          if (response.ok) {
            const data = await response.json();
            const deptIds = data.departments?.map((d: any) => d.id) || [];
            setUserDepartments(deptIds);
            
            // Só mostrar filtro de departamento se usuário tem múltiplos departamentos
            setShowDepartmentFilter(deptIds.length > 1);
          }
        } catch (error) {
          console.error('Erro ao buscar departamentos do usuário:', error);
        }
      } else {
        setShowDepartmentFilter(canViewAll);
      }
    };

    checkPermissions();
  }, [user]);

  // Carregar dados
  useEffect(() => {
    loadData();
  }, [selectedDepartment, selectedOfficial, selectedStatus, selectedRating, timeFilter, dateRange]);

  // Carregar departamentos
  useEffect(() => {
    loadDepartments();
  }, []);

  // Reset da seleção de atendente quando departamento muda
  useEffect(() => {
    if (selectedOfficial !== 'all') {
      setSelectedOfficial('all');
    }
  }, [selectedDepartment]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      
      if (selectedDepartment !== 'all') {
        params.append('department_id', selectedDepartment);
      }
      
      if (selectedOfficial !== 'all') {
        params.append('official_id', selectedOfficial);
      }
      
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      
      if (selectedRating !== 'all') {
        params.append('rating', selectedRating);
      }
      
      const { from, to } = getPeriodDates();
      params.append('date_from', format(from, 'yyyy-MM-dd'));
      params.append('date_to', format(to, 'yyyy-MM-dd'));

      const [surveysResponse, statsResponse] = await Promise.all([
        fetch(`/api/satisfaction-dashboard/surveys?${params.toString()}`),
        fetch(`/api/satisfaction-dashboard/stats?${params.toString()}`)
      ]);

      if (surveysResponse.ok && statsResponse.ok) {
        const [surveysData, statsData] = await Promise.all([
          surveysResponse.json(),
          statsResponse.json()
        ]);

        setSurveys(surveysData.surveys || []);
        setStats(statsData);
      } else {
        throw new Error('Erro ao carregar dados');
      }

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do dashboard.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/departments?active_only=true');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  };

  // Função removida - agora usando useQuery

  const exportData = async () => {
    try {
      const params = new URLSearchParams();
      
      if (selectedDepartment !== 'all') {
        params.append('department_id', selectedDepartment);
      }
      
      if (selectedOfficial !== 'all') {
        params.append('official_id', selectedOfficial);
      }
      
      const { from, to } = getPeriodDates();
      params.append('date_from', format(from, 'yyyy-MM-dd'));
      params.append('date_to', format(to, 'yyyy-MM-dd'));

      const response = await fetch(`/api/satisfaction-dashboard/export?${params.toString()}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pesquisa-satisfacao-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: 'Exportação concluída',
          description: 'Os dados foram exportados com sucesso.',
        });
      } else {
        throw new Error('Erro na exportação');
      }
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      toast({
        title: 'Erro na exportação',
        description: 'Não foi possível exportar os dados.',
        variant: 'destructive',
      });
    }
  };

  const renderStars = (rating: number | null) => {
    if (rating === null) return <span className="text-gray-400">Não avaliado</span>;
    
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= rating ? '#FCD34D' : 'none'}
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    );
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Muito insatisfeito';
      case 2: return 'Insatisfeito';
      case 3: return 'Neutro';
      case 4: return 'Satisfeito';
      case 5: return 'Muito satisfeito';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Enviado</Badge>;
      case 'responded':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Respondido</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!user || !['admin', 'company_admin', 'manager', 'supervisor'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para acessar este dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Satisfação</h1>
          <p className="text-gray-600">Acompanhe as avaliações dos clientes sobre o atendimento</p>
        </div>
        <Button onClick={exportData} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Dados
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro de Departamento */}
            {showDepartmentFilter && (
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os departamentos</SelectItem>
                    {departments
                      .filter(dept => {
                        if (canViewAllDepartments) return true;
                        return userDepartments.includes(dept.id);
                      })
                      .map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro de Atendente */}
            <div className="space-y-2">
              <Label>Atendente</Label>
              <Select value={selectedOfficial} onValueChange={setSelectedOfficial} disabled={isOfficialsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={isOfficialsLoading ? "Carregando..." : "Todos os atendentes"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os atendentes</SelectItem>
                  {officials && officials.length > 0 ? (
                    [...officials]
                      .filter((official: any) => official.is_active !== false)
                      .sort((a: any, b: any) => a.name?.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }) || 0)
                      .map((official: any) => (
                        <SelectItem key={official.id} value={official.id.toString()}>
                          {official.name}
                        </SelectItem>
                      ))
                  ) : (
                    !isOfficialsLoading && <SelectItem value="none" disabled>Nenhum atendente encontrado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="responded">Respondido</SelectItem>
                  <SelectItem value="expired">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Avaliação */}
            <div className="space-y-2">
              <Label>Avaliação</Label>
              <Select value={selectedRating} onValueChange={setSelectedRating}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as avaliações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as avaliações</SelectItem>
                  <SelectItem value="1">1 estrela</SelectItem>
                  <SelectItem value="2">2 estrelas</SelectItem>
                  <SelectItem value="3">3 estrelas</SelectItem>
                  <SelectItem value="4">4 estrelas</SelectItem>
                  <SelectItem value="5">5 estrelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtro de Data */}
          <div className="mt-4">
            <Label>Período</Label>
            <div className="mt-2">
              <DateRangeFilter
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                dateRange={dateRange}
                setDateRange={setDateRange}
                calendarOpen={calendarOpen}
                setCalendarOpen={setCalendarOpen}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Enviado */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Enviado</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.total_sent || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Taxa de Resposta */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Taxa de Resposta</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-900">
                      {stats?.response_rate ? `${stats.response_rate.toFixed(1)}%` : '0%'}
                    </p>
                    {stats?.trend?.response_rate_trend !== undefined && stats.trend.response_rate_trend !== 0 && (
                      stats.trend.response_rate_trend > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )
                    )}
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avaliação Média */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avaliação Média</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-900">
                      {stats?.average_rating ? stats.average_rating.toFixed(1) : '0.0'}
                    </p>
                    {stats?.trend?.rating_trend !== undefined && stats.trend.rating_trend !== 0 && (
                      stats.trend.rating_trend > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {renderStars(Math.round(stats?.average_rating || 0))}
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Respondido */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Respondido</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.total_responded || 0}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="surveys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="surveys">Pesquisas</TabsTrigger>
          <TabsTrigger value="analytics">Análises</TabsTrigger>
        </TabsList>

        {/* Lista de Pesquisas */}
        <TabsContent value="surveys">
          <Card>
            <CardHeader>
              <CardTitle>Pesquisas de Satisfação</CardTitle>
              <CardDescription>
                Lista de todas as pesquisas enviadas e suas respostas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : surveys.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma pesquisa encontrada
                  </h3>
                  <p className="text-gray-600">
                    Não há pesquisas de satisfação para os filtros selecionados.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {surveys.map((survey) => (
                    <div
                      key={survey.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">
                              Ticket #{survey.ticket?.ticket_id}
                            </h3>
                            {getStatusBadge(survey.status)}
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            {survey.ticket?.title}
                          </p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Cliente:</span>
                              <br />
                              {survey.customer_email}
                            </div>
                            <div>
                              <span className="font-medium">Departamento:</span>
                              <br />
                              {survey.ticket?.department_name || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Atendente:</span>
                              <br />
                              {survey.ticket?.assigned_official_name || 'Não atribuído'}
                            </div>
                            <div>
                              <span className="font-medium">Enviado em:</span>
                              <br />
                              {format(new Date(survey.sent_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          {survey.rating ? (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {renderStars(survey.rating)}
                                <span className="text-sm font-medium">
                                  {survey.rating}/5
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">
                                {getRatingText(survey.rating)}
                              </p>
                              {survey.responded_at && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Respondido em{' '}
                                  {format(new Date(survey.responded_at), 'dd/MM/yyyy', { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-gray-400">
                              <MessageSquare className="h-8 w-8 mx-auto mb-1" />
                              <p className="text-xs">Aguardando resposta</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {survey.comments && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Comentário:</span> "{survey.comments}"
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Análises */}
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribuição de Avaliações */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Avaliações</CardTitle>
                <CardDescription>
                  Quantidade de avaliações por nota
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.ratings_breakdown && (
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = stats.ratings_breakdown[rating] || 0;
                      const percentage = stats.total_responded > 0 
                        ? (count / stats.total_responded) * 100 
                        : 0;
                      
                      return (
                        <div key={rating} className="flex items-center gap-3">
                          <div className="flex items-center gap-1 w-20">
                            <span className="text-sm font-medium">{rating}</span>
                            <Star size={14} fill="#FCD34D" className="text-yellow-400" />
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-16 text-right">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumo Geral */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Período</CardTitle>
                <CardDescription>
                  Principais métricas do período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Pesquisas enviadas</span>
                    <span className="text-sm text-gray-600">{stats?.total_sent || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Pesquisas respondidas</span>
                    <span className="text-sm text-gray-600">{stats?.total_responded || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Taxa de resposta</span>
                    <span className="text-sm text-gray-600">
                      {stats?.response_rate ? `${stats.response_rate.toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium">Avaliação média</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {stats?.average_rating ? stats.average_rating.toFixed(1) : '0.0'}
                      </span>
                      {renderStars(Math.round(stats?.average_rating || 0))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SatisfactionDashboard;
