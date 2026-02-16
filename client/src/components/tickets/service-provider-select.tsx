import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Check, ChevronsUpDown, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceProvider } from '@shared/schema';

interface ServiceProviderSelectProps {
  selectedProviders: ServiceProvider[];
  onSelectionChange: (providers: ServiceProvider[]) => void;
  placeholder?: string;
  disabled?: boolean;
  departmentId?: number;
  companyId?: number;
}

export function ServiceProviderSelect({ 
  selectedProviders, 
  onSelectionChange, 
  placeholder = "Selecionar prestadores...",
  disabled = false,
  departmentId,
  companyId
}: ServiceProviderSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Query para buscar prestadores vinculados ao departamento (apenas os que podem ser atribuídos)
  const { data: allProviders = [], isLoading } = useQuery<ServiceProvider[]>({
    queryKey: ['/api/departments', departmentId, 'service-providers', { company_id: companyId, is_active: true }],
    queryFn: async () => {
      if (!departmentId) return [];
      
      // Buscar prestadores vinculados ao departamento
      const response = await fetch(`/api/departments/${departmentId}/service-providers`);
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Falha ao buscar prestadores');
      }
      const providers = await response.json();
      
      // Filtrar apenas ativos
      return providers.filter((p: ServiceProvider) => p.is_active === true);
    },
    enabled: !disabled && !!departmentId,
  });

  // Verificar se um prestador está selecionado
  const isProviderSelected = (providerId: number) => {
    return selectedProviders.some(provider => provider.id === providerId);
  };

  // Filtrar prestadores por busca
  const filteredProviders = allProviders.filter(provider => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      provider.name.toLowerCase().includes(searchLower) ||
      provider.company_name?.toLowerCase().includes(searchLower) ||
      provider.email?.toLowerCase().includes(searchLower)
    );
  });

  // Separar prestadores selecionados e não selecionados
  const selectedProvidersInList = filteredProviders.filter(provider => isProviderSelected(provider.id));
  const unselectedProviders = filteredProviders.filter(provider => !isProviderSelected(provider.id));

  // Adicionar prestador à seleção
  const addProvider = (provider: ServiceProvider) => {
    if (!isProviderSelected(provider.id)) {
      onSelectionChange([...selectedProviders, provider]);
    }
  };

  // Remover prestador da seleção
  const removeProvider = (providerId: number) => {
    onSelectionChange(selectedProviders.filter(provider => provider.id !== providerId));
  };

  // Alternar seleção de prestador
  const toggleProvider = (provider: ServiceProvider) => {
    if (isProviderSelected(provider.id)) {
      removeProvider(provider.id);
    } else {
      addProvider(provider);
    }
  };

  // Gerar texto do botão
  const _getButtonText = () => {
    if (selectedProviders.length === 0) {
      return placeholder;
    }
    if (selectedProviders.length === 1) {
      return selectedProviders[0].name;
    }
    return `${selectedProviders.length} prestadores selecionados`;
  };

  if (!departmentId) {
    return (
      <div className="text-sm text-muted-foreground">
        Selecione um departamento que utiliza prestadores de serviços
      </div>
    );
  }

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
          >
            <div className="flex flex-wrap gap-1 flex-1">
              {selectedProviders.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedProviders.map((provider) => (
                  <Badge key={provider.id} variant="secondary" className="mr-1">
                    {provider.name}
                  </Badge>
                ))
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Buscar prestador..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhum prestador encontrado"}
            </CommandEmpty>
            <CommandGroup>
              {selectedProvidersInList.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Selecionados
                  </div>
                  {selectedProvidersInList.map((provider) => (
                    <CommandItem
                      key={provider.id}
                      value={`${provider.name} ${provider.company_name || ''}`}
                      onSelect={() => toggleProvider(provider)}
                      className="cursor-pointer"
                    >
                      <Checkbox
                        checked={isProviderSelected(provider.id)}
                        onCheckedChange={() => toggleProvider(provider)}
                        className="mr-2"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        {provider.is_external ? (
                          <Building2 className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Briefcase className="h-4 w-4 text-green-500" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{provider.name}</div>
                          {provider.is_external && provider.company_name && (
                            <div className="text-xs text-muted-foreground">{provider.company_name}</div>
                          )}
                        </div>
                        <Check
                          className={cn(
                            "h-4 w-4",
                            isProviderSelected(provider.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                    </CommandItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Disponíveis
                  </div>
                </>
              )}
              {unselectedProviders.map((provider) => (
                <CommandItem
                  key={provider.id}
                  value={`${provider.name} ${provider.company_name || ''}`}
                  onSelect={() => toggleProvider(provider)}
                  className="cursor-pointer"
                >
                  <Checkbox
                    checked={isProviderSelected(provider.id)}
                    onCheckedChange={() => toggleProvider(provider)}
                    className="mr-2"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {provider.is_external ? (
                      <Building2 className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Briefcase className="h-4 w-4 text-green-500" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{provider.name}</div>
                      {provider.is_external && provider.company_name && (
                        <div className="text-xs text-muted-foreground">{provider.company_name}</div>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4",
                        isProviderSelected(provider.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Mostrar prestadores selecionados */}
      {selectedProviders.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedProviders.map((provider) => (
            <Badge
              key={provider.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {provider.name}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removeProvider(provider.id)}
              >
                ×
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

