import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from '@/i18n';

interface Customer {
  id: number;
  name: string;
  email: string;
  company?: string;
  active: boolean;
}

interface CustomerSearchProps {
  value?: number;
  onValueChange: (customerId: number, customer: Customer) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomerSearch({ 
  value, 
  onValueChange, 
  placeholder = "Buscar cliente...",
  disabled = false 
}: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { formatMessage } = useI18n();

    // Query para buscar TODOS os clientes da empresa
  const { data: allCustomers = [], isLoading, error } = useQuery<Customer[]>({
    queryKey: ["/api/customers/search"],
    queryFn: async () => {
      const response = await fetch('/api/customers?limit=1000&includeInactive=false');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao buscar clientes: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      
      // Se os dados vêm do endpoint original (/api/customers), eles estão em data.data
      // Se vêm do endpoint de busca, são diretos
      const customers = Array.isArray(data) ? data : (data.data || []);
      
      return customers;
    },
    enabled: !disabled,
  });

  // Filtrar clientes localmente conforme o usuário digita
  const filteredCustomers = allCustomers.filter(customer => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      (customer.company && customer.company.toLowerCase().includes(searchLower))
    );
  });

  // Verificar se deve mostrar informação da empresa (apenas para admins)
  const showCompanyInfo = user?.role === 'admin';

  // Encontrar o cliente selecionado
  const selectedCustomer = allCustomers.find(customer => customer.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedCustomer ? (
            <div className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              <span className="truncate">{selectedCustomer.name}</span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={formatMessage('new_ticket.type_to_search_customer')} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {isLoading ? formatMessage('new_ticket.loading_customers') : 
             error ? formatMessage('new_ticket.error_loading_customers', { error: error.message }) :
             formatMessage('new_ticket.no_customers_found')}
          </CommandEmpty>
          <CommandGroup>
            {!isLoading && search && (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {formatMessage('new_ticket.customers_found', { count: filteredCustomers.length })}
              </div>
            )}
            {!isLoading && !search && allCustomers.length > 0 && (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {formatMessage('new_ticket.customers_available', { count: allCustomers.length })}
              </div>
            )}
            {filteredCustomers.map((customer: Customer) => (
              <CommandItem
                key={customer.id}
                value={`${customer.name} ${customer.email} ${customer.company || ''}`}
                onSelect={() => {
                  onValueChange(customer.id, customer);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === customer.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{customer.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {customer.email}
                    {showCompanyInfo && customer.company && ` • ${customer.company}`}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 