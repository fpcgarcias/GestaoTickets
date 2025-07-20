import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  company_id?: number;
}

interface ParticipantSearchProps {
  selectedUsers: User[];
  onSelectionChange: (users: User[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxParticipants?: number;
  excludeUserIds?: number[];
  ticketCompanyId?: number; // 🔥 FASE 5.1: Adicionar suporte para filtrar por empresa
}

export function ParticipantSearch({ 
  selectedUsers, 
  onSelectionChange, 
  placeholder = "Selecionar participantes...",
  disabled = false,
  maxParticipants = 10,
  excludeUserIds = [],
  ticketCompanyId // 🔥 FASE 5.1: Adicionar suporte para filtrar por empresa
}: ParticipantSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  // Query para buscar usuários (usando a rota existente que já tem a lógica de permissões)
  const { data: allUsers = [], isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/company/users"],
    queryFn: async () => {
      const response = await fetch('/api/company/users?includeInactive=false');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao buscar usuários: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return data;
    },
    enabled: !disabled,
  });

  // Verificar se um usuário está selecionado
  const isUserSelected = (userId: number) => {
    return selectedUsers.some(user => user.id === userId);
  };

  // 🔥 FASE 5.1: Filtrar usuários por empresa e validar se são atendentes/clientes
  const filteredUsers = allUsers.filter(user => {
    // Excluir usuários que já são participantes
    if (excludeUserIds.includes(user.id)) return false;
    
    // 🔥 FASE 5.1: Filtrar por empresa se especificado
    if (ticketCompanyId && user.company_id !== ticketCompanyId) {
      return false;
    }
    
    // 🔥 FASE 5.1: Apenas usuários ativos
    if (!user.active) {
      return false;
    }
    
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  // Separar usuários selecionados e não selecionados
  const selectedUsersInList = filteredUsers.filter(user => isUserSelected(user.id));
  const unselectedUsers = filteredUsers.filter(user => !isUserSelected(user.id));

  // Adicionar usuário à seleção
  const addUser = (user: User) => {
    if (selectedUsers.length >= maxParticipants) {
      return; // Limite máximo atingido
    }
    if (!isUserSelected(user.id)) {
      onSelectionChange([...selectedUsers, user]);
    }
  };

  // Remover usuário da seleção
  const removeUser = (userId: number) => {
    onSelectionChange(selectedUsers.filter(user => user.id !== userId));
  };

  // Alternar seleção de usuário
  const toggleUser = (user: User) => {
    if (isUserSelected(user.id)) {
      removeUser(user.id);
    } else {
      addUser(user);
    }
  };

  // Gerar texto do botão
  const getButtonText = () => {
    if (selectedUsers.length === 0) {
      return placeholder;
    }
    return `${selectedUsers.length} participante(s) selecionado(s)`;
  };

  // Verificar se está no limite
  const isAtLimit = selectedUsers.length >= maxParticipants;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            role="combobox"
            aria-expanded={open}
            className={cn(
              "flex min-h-[40px] w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              open && "ring-2 ring-ring ring-offset-2"
            )}
            onClick={() => !disabled && setOpen(!open)}
          >
            <div className="flex flex-1 flex-wrap gap-1">
              {selectedUsers.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {selectedUsers.slice(0, 3).map((user) => (
                    <Badge
                      key={user.id}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1 text-xs"
                    >
                      <span className="truncate max-w-[100px]">{user.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUser(user.id);
                        }}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {selectedUsers.length > 3 && (
                    <Badge variant="secondary" className="px-2 py-1 text-xs">
                      e mais {selectedUsers.length - 3}
                    </Badge>
                  )}
                </>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Digite para buscar usuários..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>
              {isLoading ? "Carregando usuários..." : 
               error ? `Erro: ${error.message}` :
               "Nenhum usuário encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {!isLoading && search && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {filteredUsers.length} usuário(s) encontrado(s)
                </div>
              )}
              {!isLoading && !search && allUsers.length > 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {allUsers.length} usuário(s) disponível(is)
                </div>
              )}
              {isAtLimit && (
                <div className="px-2 py-1 text-xs text-orange-600 bg-orange-50 border-l-2 border-orange-200">
                  Limite máximo de {maxParticipants} participantes atingido
                </div>
              )}
              
              {/* Separador visual se há participantes selecionados */}
              {selectedUsersInList.length > 0 && unselectedUsers.length > 0 && (
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t border-border mt-2 pt-2">
                  Participantes Selecionados
                </div>
              )}
              
              {/* Lista de usuários selecionados */}
              {selectedUsersInList.map((user: User) => {
                const isSelected = isUserSelected(user.id);
                const isDisabled = !isSelected && isAtLimit;
                
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email} ${user.username} ${user.role}`}
                    onSelect={() => toggleUser(user)}
                    className={cn(
                      "flex items-center space-x-2",
                      isDisabled && "opacity-50 cursor-not-allowed",
                      "bg-muted/50" // Destaque visual para selecionados
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="mr-2"
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        <Badge variant="outline" className="text-xs text-green-600">
                          Selecionado
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <Check className="h-4 w-4 text-primary" />
                  </CommandItem>
                );
              })}
              
              {/* Separador para usuários não selecionados */}
              {selectedUsersInList.length > 0 && unselectedUsers.length > 0 && (
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t border-border mt-2 pt-2">
                  Outros Usuários
                </div>
              )}
              
              {/* Lista de usuários não selecionados */}
              {unselectedUsers.map((user: User) => {
                const isSelected = isUserSelected(user.id);
                const isDisabled = !isSelected && isAtLimit;
                
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email} ${user.username} ${user.role}`}
                    onSelect={() => toggleUser(user)}
                    className={cn(
                      "flex items-center space-x-2",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className="mr-2"
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>


    </div>
  );
} 