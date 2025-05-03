import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusDot, PriorityBadge } from './status-badge';
import { SLAIndicator } from './sla-indicator';
import { formatDate, DEPARTMENTS } from '@/lib/utils';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export var TicketCard = function (_a) {
    var _b;
    var ticket = _a.ticket, 
        onAssignTicket = _a.onAssignTicket, 
        isAssigning = _a.isAssigning;
    
    // Estado para controlar feedback de atribuição bem-sucedida
    const [showSuccess, setShowSuccess] = useState(false);
    const [prevAssignedId, setPrevAssignedId] = useState(ticket.assignedToId);
    
    // Efeito para detectar mudanças no assignedToId e mostrar feedback visual
    useEffect(() => {
        if (prevAssignedId !== ticket.assignedToId && !isAssigning) {
            // Mostra o ícone de sucesso
            setShowSuccess(true);
            
            // Esconde após 2 segundos
            const timer = setTimeout(() => {
                setShowSuccess(false);
            }, 2000);
            
            // Atualiza o prevAssignedId
            setPrevAssignedId(ticket.assignedToId);
            
            // Limpa o timer se o componente desmontar
            return () => clearTimeout(timer);
        }
    }, [ticket.assignedToId, isAssigning, prevAssignedId]);
    
    // Valor padrão para onAssignTicket caso não seja fornecido
    var handleAssignTicket = onAssignTicket || function(ticketId, officialId) {
        toast({
            title: "Funcionalidade não disponível",
            description: "A atribuição de atendentes diretamente da listagem ainda não foi implementada no componente pai.",
            variant: "destructive"
        });
        console.warn("onAssignTicket não foi fornecido ao componente TicketCard. Por favor, passe esta função como prop.");
    };
    
    var id = ticket.id, 
        ticketId = ticket.ticketId, 
        title = ticket.title, 
        description = ticket.description, 
        status = ticket.status, 
        priority = ticket.priority, 
        createdAt = ticket.createdAt, 
        customer = ticket.customer,
        customerEmail = ticket.customerEmail,
        assignedToId = ticket.assignedToId,
        departmentId = ticket.departmentId,
        customerId = ticket.customerId;
    
    // Buscar informações dos clientes se necessário
    var customersQuery = useQuery({
        queryKey: ['/api/customers'],
        staleTime: 10 * 60 * 1000, // 10 minutos
    });
    
    // Caso o cliente não esteja disponível no ticket, mas temos o email,
    // tentar encontrar o cliente pelo email
    var customerData = React.useMemo(function() {
        // Se já temos dados do cliente no ticket e tem nome, usar isso
        if (customer && customer.name) {
            return customer;
        }
        
        // Se temos o email do cliente, mas não temos os dados completos
        if (customerEmail && customersQuery.data) {
            var matchingCustomer = customersQuery.data.find(function(c) {
                return c.email === customerEmail;
            });
            
            if (matchingCustomer) {
                console.log(`[DEBUG] Encontrado cliente pelo email para ticket ${id}:`, matchingCustomer.name);
                return matchingCustomer;
            }
        }
        
        // Caso contrário, manter o customer original ou um objeto vazio
        return customer || { name: null, avatarUrl: null };
    }, [customer, customerEmail, customersQuery.data, id]);
    
    var officialsQuery = useQuery({
        queryKey: ['/api/officials'],
        staleTime: 5 * 60 * 1000,
    });
    
    var allOfficialsData = officialsQuery.data;
    var isOfficialsLoading = officialsQuery.isLoading;
    
    var filteredOfficials = React.useMemo(function() {
        var allOfficials = Array.isArray(allOfficialsData) ? allOfficialsData : [];
        
        // Obter o nome do departamento baseado no ID
        const ticketDepartment = DEPARTMENTS.find(d => d.id === departmentId);
        const targetDepartmentName = ticketDepartment?.enumValue?.toLowerCase();

        console.log(`[DEBUG] Buscando atendentes para:`, {
            departmentId,
            ticketDepartment,
            targetDepartmentName
        });

        const filtered = allOfficials.filter(function(official) {
            return official.departments?.some(function(dept) {
                // Comparar o nome do departamento (technical/support/etc)
                const deptName = typeof dept === 'object' ? 
                    dept.department?.toLowerCase() : 
                    dept?.toLowerCase();
                
                return deptName === targetDepartmentName;
            });
        });
        
        console.log(`[DEBUG TicketCard ${id}] Atendentes filtrados para Depto Enum ${departmentId}:`, 
                    filtered.map(o => ({ id: o.id, name: o.name, departments: o.departments })) );
                    
        return filtered;
        
    }, [allOfficialsData, departmentId, id]); 
    
    var handleSelectChange = function(value) {
        // Se o ticket estiver resolvido, não permitir alteração
        if (status === 'resolved') {
            toast({
                title: "Operação não permitida",
                description: "Não é possível alterar o atendente de um ticket resolvido.",
                variant: "destructive"
            });
            return;
        }
        
        var officialId = value === "unassigned" ? null : parseInt(value);
        console.log("[DEBUG TicketCard] Mudando atendente do ticket", id, "de", assignedToId, "para", officialId);
        
        // Feedback visual imediato 
        // Não precisamos atualizar prevAssignedId aqui, pois o useEffect cuidará disso quando os props mudarem
        
        // Chamar a função de atribuição
        handleAssignTicket(id, officialId);
    };
    
    // Verificar se o ticket está resolvido para desabilitar o select
    const isResolved = status === 'resolved';
    
    // Debug para verificar valor atual
    console.log("[DEBUG TicketCard] Renderizando ticket", id, {
        assignedToId,
        departmentId,
        tipo: ticket.type,
        filteredOfficials: filteredOfficials.map(o => ({id: o.id, name: o.name, departments: o.departments}))
    });
    
    return (<Card className="ticket-card hover:shadow-md transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <StatusDot status={status}/>
            <span className="font-medium text-neutral-800">Ticket# {ticketId}</span>
          </div>
          <div className="flex items-center">
            {priority && <PriorityBadge priority={priority}/>}
            <div className="text-sm text-neutral-500">
              Criado em {formatDate(createdAt)}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <p className="text-neutral-600 line-clamp-2">{description}</p>
        </div>
        
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center">
            <Avatar className="w-7 h-7 mr-2">
              <AvatarImage src={customerData.avatarUrl || ""} alt={customerData.name}/>
              <AvatarFallback>{((_b = customerData.name) === null || _b === void 0 ? void 0 : _b.charAt(0)) || "C"}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-neutral-700">{customerData.name || 'Cliente não informado'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isOfficialsLoading ? (
              <div className="text-xs text-gray-500">Carregando atendentes...</div>
            ) : filteredOfficials.length === 0 ? (
              <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded border border-red-200">
                Sem atendentes ({departmentId ? "Depto #" + departmentId : 'Sem Depto'})
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isAssigning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {showSuccess && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <Select 
                  value={assignedToId?.toString() || "unassigned"}
                  onValueChange={handleSelectChange}
                  disabled={isAssigning || isOfficialsLoading || isResolved}
                >
                  <SelectTrigger 
                    className={`
                      w-[180px] h-8 text-xs font-medium 
                      ${isResolved 
                        ? 'bg-gray-100 border-2 border-gray-200 text-gray-500 cursor-not-allowed opacity-70' 
                        : assignedToId 
                          ? 'bg-green-50 border-2 border-green-200 hover:border-green-300 text-green-700' 
                          : 'bg-primary/5 border-2 border-primary/20 hover:border-primary/30'
                      }
                      ${showSuccess ? 'animate-pulse' : ''}
                    `}
                  >
                    <SelectValue placeholder={isResolved ? "Ticket Resolvido" : "Atribuir a..."} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-[180px] z-50">
                    <SelectItem value="unassigned" className="text-gray-500 font-medium">
                      Não atribuído
                    </SelectItem>
                    {filteredOfficials.map(function(official) {
                      console.log(`[DEBUG] Estrutura completa do atendente:`, {
                          id: official.id,
                          name: official.name,
                          departments: official.departments,
                          rawDepartmentId: departmentId,
                          departmentIdType: typeof departmentId
                      });
                      return (
                        <SelectItem 
                          key={official.id} 
                          value={official.id.toString()} 
                          className="text-primary-dark font-medium"
                        >
                          {official.name || "Atendente " + official.id}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <Button 
              variant="link" 
              className="text-primary hover:text-primary-dark text-sm font-medium px-0 h-8"
              asChild
            >
              <Link href={"/tickets/".concat(id)}>Abrir</Link>
            </Button>
          </div>
        </div>
        
        {/* Status do SLA */}
        {status !== 'resolved' && (
          <div className="mt-3">
            <SLAIndicator 
              ticketCreatedAt={createdAt.toString()} 
              ticketPriority={priority} 
              ticketStatus={status} 
            />
          </div>
        )}
      </CardContent>
    </Card>);
};