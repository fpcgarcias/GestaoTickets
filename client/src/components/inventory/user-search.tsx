import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from '@/i18n';

interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  active: boolean;
  company_id?: number;
}

interface UserSearchProps {
  value?: string;
  onValueChange: (userId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UserSearch({ 
  value, 
  onValueChange, 
  placeholder = "Selecione o usuário responsável",
  disabled = false 
}: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { formatMessage: _formatMessage } = useI18n();

  // Query para buscar usuários
  const { data: allUsers = [], isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/company/users"],
    queryFn: async () => {
      const response = await fetch('/api/company/users?includeInactive=false');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao buscar usuários: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !disabled,
  });

  // Filtrar usuários
  const filteredUsers = allUsers.filter(user => {
    // Apenas usuários ativos
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

  // Encontrar o usuário selecionado
  const selectedUser = allUsers.find(user => String(user.id) === value);

  // Separar usuário selecionado e não selecionados
  const selectedUserInList = filteredUsers.filter(user => String(user.id) === value);
  const unselectedUsers = filteredUsers.filter(user => String(user.id) !== value);

  // Selecionar usuário (único)
  const selectUser = (user: User) => {
    onValueChange(String(user.id));
    setOpen(false);
  };

  // Limpar seleção
  const clearSelection = () => {
    onValueChange("");
    setOpen(false);
  };

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
            <div className="flex flex-1 items-center">
              {selectedUser ? (
                <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1 text-xs">
                  <span className="truncate max-w-[200px]">{selectedUser.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    ×
                  </button>
                </Badge>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 z-[100]" align="start">
          <Command className="max-h-[400px]">
            <CommandInput 
              placeholder="Digite para buscar usuários..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                {isLoading ? "Carregando usuários..." : 
                 error ? `Erro ao carregar usuários: ${error.message}` :
                 "Nenhum usuário encontrado"}
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
              
              {/* Separador visual se há usuário selecionado */}
              {selectedUserInList.length > 0 && unselectedUsers.length > 0 && (
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t border-border mt-2 pt-2">
                  Selecionado
                </div>
              )}
              
              {/* Usuário selecionado */}
              {selectedUserInList.map((user: User) => {
                const _isSelected = value === String(user.id);
                
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email} ${user.username} ${user.role}`}
                    onSelect={() => selectUser(user)}
                    className="flex items-center space-x-2 bg-muted/50"
                  >
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
              {selectedUserInList.length > 0 && unselectedUsers.length > 0 && (
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t border-border mt-2 pt-2">
                  Outros usuários
                </div>
              )}
              
              {/* Opção para limpar seleção (apenas se tiver algo selecionado) */}
              {value && (
                <CommandItem
                  value="__none__"
                  onSelect={clearSelection}
                  className="flex items-center space-x-2"
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 opacity-0")}
                  />
                  <div className="flex flex-col flex-1">
                    <span className="text-muted-foreground font-medium">Nenhum (limpar seleção)</span>
                  </div>
                </CommandItem>
              )}
              
              {/* Lista de usuários não selecionados */}
              {unselectedUsers.map((user: User) => {
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.name} ${user.email} ${user.username} ${user.role}`}
                    onSelect={() => selectUser(user)}
                    className="flex items-center space-x-2"
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4 opacity-0")}
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
