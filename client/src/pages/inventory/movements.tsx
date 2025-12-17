import { useMemo, useState, useEffect } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig, InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import {
  useApproveInventoryMovement,
  useCreateInventoryMovement,
  useInventoryMovements,
  useRejectInventoryMovement,
  useDeleteInventoryMovement,
  useInventoryLocations,
  useInventoryProducts,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Trash, Calendar as CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { UserSearch } from "@/components/inventory/user-search";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ptBR, enUS } from "date-fns/locale";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const MOVEMENT_TYPES = ["entry", "withdrawal", "return", "transfer", "maintenance", "reservation", "write_off"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const ALL_VALUE = "__all__";

interface MovementFormState {
  productId: string;
  movementType: string;
  quantity: string;
  ticketId: string;
  notes: string;
  isStockTransfer: boolean;
  responsibleId: string;
  fromLocationId: string;
  toLocationId: string;
  expectedReturnDate: string;
}

const DEFAULT_FORM: MovementFormState = {
  productId: "",
  movementType: "withdrawal",
  quantity: "1",
  ticketId: "",
  notes: "",
  isStockTransfer: false,
  responsibleId: "",
  fromLocationId: "",
  toLocationId: "",
  expectedReturnDate: "",
};

export default function InventoryMovementsPage() {
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    search: "",
    movementType: "",
    approvalStatus: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<MovementFormState>(DEFAULT_FORM);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [popoverProductOpen, setPopoverProductOpen] = useState(false);

  const movementsQuery = useInventoryMovements({
    search: filters.search || undefined,
    movementType: filters.movementType || undefined,
    approvalStatus: filters.approvalStatus || undefined,
    page,
    limit: pageSize,
  });

  const createMovement = useCreateInventoryMovement();
  const approveMovement = useApproveInventoryMovement();
  const rejectMovement = useRejectInventoryMovement();
  const deleteMovement = useDeleteInventoryMovement();

  const movements = movementsQuery.data?.data ?? [];
  const paginationInfo = movementsQuery.data?.pagination;
  const totalItems = paginationInfo?.total ?? movements.length;

  // Buscar localizações
  const { data: locationsData } = useInventoryLocations();
  const locations = locationsData?.data ?? [];

  // Função para determinar o filtro de status baseado no tipo de movimentação
  const getStatusFilter = (): string | undefined => {
    switch (formState.movementType) {
      case 'withdrawal': // Entrega
        return 'available'; // Só equipamentos disponíveis
      case 'return': // Devolução - precisa buscar múltiplos status
        // Vamos buscar sem filtro e filtrar no frontend
        return undefined;
      case 'transfer': // Transferência
        return 'available'; // Só equipamentos disponíveis
      case 'maintenance': // Manutenção
        return 'in_use'; // Só equipamentos em uso
      case 'reservation': // Empréstimo temporário
        return 'available'; // Só equipamentos disponíveis
      case 'entry': // Entrada
        return undefined; // Sem filtro
      case 'write_off': // Baixa
        return undefined; // Sem filtro
      default:
        return undefined;
    }
  };

  // Buscar produtos com filtro baseado no tipo de movimentação
  const inventoryProductsQuery = useInventoryProducts({
    page: 1,
    limit: 100,
    search: searchProduct || undefined,
    status: getStatusFilter(),
  });

  // Para devolução, filtrar produtos que estão in_use, maintenance ou reserved
  const allProducts = inventoryProductsQuery.data?.data ?? [];
  const products = useMemo(() => {
    if (formState.movementType === 'return') {
      // Devolução: apenas equipamentos que estão com usuário, em manutenção ou emprestados
      return allProducts.filter((p: any) => 
        p.status === 'in_use' || p.status === 'maintenance' || p.status === 'reserved'
      );
    }
    return allProducts;
  }, [allProducts, formState.movementType]);

  const selectedProduct = products.find((p: any) => String(p.id) === formState.productId);

  // Limpar seleção de produto quando o tipo de movimentação mudar
  useEffect(() => {
    if (formState.movementType) {
      setFormState(prev => ({ ...prev, productId: "" }));
      setSearchProduct("");
    }
  }, [formState.movementType]);

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: filters.search,
      placeholder: formatMessage("inventory.movements.filters.search"),
      width: 240,
    },
    {
      type: "select",
      key: "movementType",
      value: filters.movementType || ALL_VALUE,
      placeholder: formatMessage("inventory.movements.filters.type"),
      options: [
        { value: ALL_VALUE, label: formatMessage("inventory.movements.filters.all_types") },
        ...MOVEMENT_TYPES.map((type) => ({
          value: type,
          label: formatMessage(`inventory.movements.types.${type}` as any),
        })),
      ],
      width: 200,
    },
    {
      type: "select",
      key: "approvalStatus",
      value: filters.approvalStatus || ALL_VALUE,
      placeholder: formatMessage("inventory.movements.filters.status"),
      options: [
        { value: ALL_VALUE, label: formatMessage("inventory.movements.filters.all_status") },
        ...APPROVAL_STATUSES.map((status) => ({
          value: status,
          label: formatMessage(`inventory.movements.status.${status}` as any),
        })),
      ],
      width: 200,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    const normalizedValue = value === ALL_VALUE ? "" : value;
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: String(normalizedValue ?? "") }));
  };

  const resetFilters = () => {
    setFilters({ search: "", movementType: "", approvalStatus: "" });
    setPage(1);
  };

  const openDrawer = () => {
    setFormState(DEFAULT_FORM);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setFormState(DEFAULT_FORM);
  };

  const handleFormChange = (field: keyof MovementFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    // Se desmarcar movimentação entre estoques, limpar campos de localização
    if (field === 'isStockTransfer' && value === false) {
      setFormState((prev) => ({ ...prev, fromLocationId: "", toLocationId: "" }));
    }
    // Se marcar movimentação entre estoques, limpar usuário responsável
    if (field === 'isStockTransfer' && value === true) {
      setFormState((prev) => ({ ...prev, responsibleId: "" }));
    }
  };

  const handleSubmit = () => {
    if (!formState.productId.trim()) {
      toast({
        title: formatMessage("inventory.movements.form.validation.product"),
        variant: "destructive",
      });
      return;
    }

    // Validação: se movimentação entre estoques, localizações são obrigatórias
    if (formState.isStockTransfer) {
      if (!formState.fromLocationId || !formState.toLocationId) {
        toast({
          title: "Localização de origem e destino são obrigatórias para movimentação entre estoques",
          variant: "destructive",
        });
        return;
      }
    }

    // Validação: data prevista é obrigatória para empréstimo temporário e manutenção
    if ((formState.movementType === 'reservation' || formState.movementType === 'maintenance') && !formState.expectedReturnDate) {
      toast({
        title: "Data prevista de devolução é obrigatória para empréstimo temporário e manutenção",
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      product_id: Number(formState.productId),
      movement_type: formState.movementType,
      quantity: Number(formState.quantity) || 1,
      ticket_id: formState.ticketId ? Number(formState.ticketId) : undefined,
      notes: formState.notes || undefined,
      is_stock_transfer: formState.isStockTransfer,
    };

    // Adicionar campos condicionais
    if (formState.isStockTransfer) {
      payload.from_location_id = Number(formState.fromLocationId);
      payload.to_location_id = Number(formState.toLocationId);
      payload.responsible_id = undefined;
    } else {
      if (formState.responsibleId) {
        payload.responsible_id = Number(formState.responsibleId);
      }
      if (formState.toLocationId) {
        payload.to_location_id = Number(formState.toLocationId);
      }
    }

    // Adicionar data prevista de devolução para empréstimo temporário e manutenção
    if ((formState.movementType === 'reservation' || formState.movementType === 'maintenance') && formState.expectedReturnDate) {
      payload.assignment = {
        expectedReturnDate: formState.expectedReturnDate,
      };
    }

    createMovement.mutate(payload, {
      onSuccess: () => {
        closeDrawer();
        toast({ title: formatMessage("inventory.movements.form.success") });
      },
    });
  };

  const handleApprove = (id: number) => {
    approveMovement.mutate({ id });
  };

  const handleReject = (id: number) => {
    rejectMovement.mutate({ id });
  };

  const formatDateValue = (value?: string | null) => {
    if (!value) return "--";
    // Para timestamps completos (com hora), new Date funciona corretamente
    // Mas para datas simples (YYYY-MM-DD), precisamos evitar timezone
    if (value.length === 10) {
      // Data sem hora: fazer parsing manual
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy");
    }
    // Timestamp completo: usar new Date normalmente
    const date = new Date(value);
    return format(date, locale === "en-US" ? "MM/dd/yyyy HH:mm" : "dd/MM/yyyy HH:mm");
  };

  const columns: EntityColumn<any>[] = useMemo(
    () => [
      {
        key: "id",
        header: formatMessage("inventory.movements.table.id"),
        render: (movement) => movement.id,
      },
      {
        key: "product",
        header: formatMessage("inventory.movements.table.product"),
        render: (movement) => {
          if (movement.is_batch_movement && movement.batchProducts && movement.batchProducts.length > 0) {
            return (
              <div className="flex flex-col">
                <span className="font-medium">{movement.batchProducts.length} produto(s)</span>
                <div className="text-xs text-muted-foreground space-y-1">
                  {movement.batchProducts.slice(0, 2).map((p, idx) => (
                    <div key={p.id}>
                      {p.name}
                    </div>
                  ))}
                  {movement.batchProducts.length > 2 && (
                    <div className="text-muted-foreground">+{movement.batchProducts.length - 2} mais</div>
                  )}
                </div>
              </div>
            );
          }
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {movement.product?.name || formatMessage("inventory.overview.top.unknown")}
              </span>
            </div>
          );
        },
      },
      {
        key: "type",
        header: formatMessage("inventory.movements.table.type"),
        render: (movement) => (
          <Badge variant="secondary">
            {formatMessage(`inventory.movements.types.${movement.movement_type}` as any)}
          </Badge>
        ),
      },
      {
        key: "quantity",
        header: formatMessage("inventory.movements.table.quantity"),
        render: (movement) => {
          if (movement.is_batch_movement && movement.batchProducts) {
            return movement.batchProducts.length;
          }
          return movement.quantity ?? 1;
        },
      },
      {
        key: "ticket",
        header: formatMessage("inventory.movements.table.ticket"),
        render: (movement) => movement.ticket_code ?? "--",
      },
      {
        key: "responsible",
        header: formatMessage("inventory.movements.table.responsible"),
        render: (movement) => movement.responsible_name ?? "--",
      },
      {
        key: "status",
        header: formatMessage("inventory.movements.table.status"),
        render: (movement) => <InventoryStatusBadge status={movement.approval_status} />,
      },
      {
        key: "date",
        header: formatMessage("inventory.movements.table.date"),
        render: (movement) => formatDateValue(movement.movement_date),
      },
      {
        key: "actions",
        header: formatMessage("inventory.movements.table.actions"),
        render: (movement) => (
          <div className="flex justify-end gap-2">
            {movement.approval_status === "pending" && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleApprove(movement.id)}>
                  {formatMessage("inventory.movements.table.approve")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleReject(movement.id)}>
                  {formatMessage("inventory.movements.table.reject")}
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const confirmed = window.confirm(formatMessage("inventory.movements.table.confirm_delete"));
                if (!confirmed) return;
                deleteMovement.mutate({ id: movement.id });
              }}
              title={formatMessage("inventory.movements.table.delete")}
            >
              <Trash className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [formatDateValue, formatMessage, deleteMovement, handleApprove, handleReject]
  );

  return (
    <InventoryLayout
      title={formatMessage("inventory.movements_title")}
      description={formatMessage("inventory.movements_description")}
      breadcrumb={[{ label: formatMessage("inventory.movements_breadcrumb") }]}
      actions={
        <Button onClick={openDrawer}>{formatMessage("inventory.movements.actions.new_movement")}</Button>
      }
    >
      <div className="space-y-4">
        <InventoryFilterBar
          filters={filterConfigs}
          onChange={handleFilterChange}
          onReset={resetFilters}
          isDirty={Boolean(filters.search || filters.movementType || filters.approvalStatus)}
        />
        <EntityTable
          data={movements}
          columns={columns}
          isLoading={movementsQuery.isLoading}
          pagination={{
            page: paginationInfo?.page ?? page,
            pageSize,
            totalItems,
            onPageChange: setPage,
          }}
          emptyTitle={formatMessage("inventory.movements.table.empty_title")}
          emptyDescription={formatMessage("inventory.movements.table.empty_description")}
        />
      </div>

      {/* Modal para registrar movimentação */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-md shadow-lg max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                {formatMessage("inventory.movements.drawer.title")}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeDrawer}
              >
                ✕
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage("inventory.movements.drawer.subtitle")}
            </p>
            <form className="space-y-4">
              {/* Tipo de movimentação PRIMEIRO */}
              <div className="space-y-2">
                <Label>{formatMessage("inventory.movements.form.movement_type")}</Label>
                <Select
                  value={formState.movementType}
                  onValueChange={(value) => handleFormChange("movementType", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatMessage(`inventory.movements.types.${type}` as any)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Equipamento - busca igual à tela de tickets */}
              {formState.movementType && (
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.movements.form.product_id")}</Label>
                  <Popover open={popoverProductOpen} onOpenChange={setPopoverProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={popoverProductOpen}
                        className="w-full justify-between items-center h-auto min-h-11 whitespace-normal text-left"
                      >
                        {selectedProduct ? (
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{selectedProduct.name}</span>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {selectedProduct.serial_number && <span>S/N: {selectedProduct.serial_number}</span>}
                              {selectedProduct.service_tag && <span>Service Tag: {selectedProduct.service_tag}</span>}
                              {selectedProduct.asset_number && <span>Patrimônio: {selectedProduct.asset_number}</span>}
                            </div>
                          </div>
                        ) : (
                          "Selecione o equipamento"
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-[400px] max-w-md p-0" align="start">
                      <Command className="max-h-[300px]">
                        <CommandInput
                          placeholder="Buscar por nome, serial, service tag ou patrimônio..."
                          value={searchProduct}
                          onValueChange={setSearchProduct}
                        />
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>
                            <div className="py-6 text-center text-sm">
                              Nenhum equipamento encontrado
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {products.map((p: any) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.name} ${p.serial_number || ''} ${p.service_tag || ''} ${p.asset_number || ''}`}
                                onSelect={() => {
                                  handleFormChange("productId", String(p.id));
                                  setPopoverProductOpen(false);
                                  setSearchProduct("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formState.productId === String(p.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{p.name}</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    {p.serial_number && <span>S/N: {p.serial_number}</span>}
                                    {p.service_tag && <span>Service Tag: {p.service_tag}</span>}
                                    {p.asset_number && <span>Patrimônio: {p.asset_number}</span>}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isStockTransfer"
                  checked={formState.isStockTransfer}
                  onCheckedChange={(checked) => handleFormChange("isStockTransfer", checked === true)}
                />
                <Label htmlFor="isStockTransfer" className="font-normal cursor-pointer">
                  Movimentação entre estoques
                </Label>
              </div>

              {/* Data prevista logo abaixo do checkbox */}
              {(formState.movementType === 'maintenance' || formState.movementType === 'reservation') && (
                <div className="space-y-2">
                  <Label>Data prevista de devolução *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formState.expectedReturnDate ? (
                          format(new Date(formState.expectedReturnDate), locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy", {
                            locale: locale === "en-US" ? enUS : ptBR,
                          })
                        ) : (
                          <span className="text-muted-foreground">Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formState.expectedReturnDate ? new Date(formState.expectedReturnDate) : undefined}
                        onSelect={(date: Date | undefined) => {
                          if (date) {
                            handleFormChange("expectedReturnDate", format(date, "yyyy-MM-dd"));
                            setCalendarOpen(false);
                          }
                        }}
                        locale={locale === "en-US" ? enUS : ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {formState.isStockTransfer ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Localização de origem *</Label>
                      <Select
                        value={formState.fromLocationId}
                        onValueChange={(value) => handleFormChange("fromLocationId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a localização de origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location: any) => (
                            <SelectItem key={location.id} value={String(location.id)}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Localização de destino *</Label>
                      <Select
                        value={formState.toLocationId}
                        onValueChange={(value) => handleFormChange("toLocationId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a localização de destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((location: any) => (
                            <SelectItem key={location.id} value={String(location.id)}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Usuário responsável (opcional)</Label>
                    <UserSearch
                      value={formState.responsibleId}
                      onValueChange={(value) => handleFormChange("responsibleId", value)}
                      placeholder="Selecione o usuário responsável"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização de destino (opcional)</Label>
                    <Select
                      value={formState.toLocationId || undefined}
                      onValueChange={(value) => handleFormChange("toLocationId", value === "__none__" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a localização de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {locations.map((location: any) => (
                          <SelectItem key={location.id} value={String(location.id)}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.movements.form.quantity")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formState.quantity}
                    onChange={(event) => handleFormChange("quantity", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.movements.form.ticket_id")}</Label>
                  <Input
                    value={formState.ticketId}
                    onChange={(event) => handleFormChange("ticketId", event.target.value)}
                  />
                </div>
              </div>
              {(formState.movementType === 'maintenance' || formState.movementType === 'reservation') && (
                <div className="space-y-2">
                  <Label>Data prevista de devolução *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formState.expectedReturnDate ? (
                          format(new Date(formState.expectedReturnDate), locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy", {
                            locale: locale === "en-US" ? enUS : ptBR,
                          })
                        ) : (
                          <span className="text-muted-foreground">Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formState.expectedReturnDate ? new Date(formState.expectedReturnDate) : undefined}
                        onSelect={(date: Date | undefined) => {
                          if (date) {
                            handleFormChange("expectedReturnDate", format(date, "yyyy-MM-dd"));
                            setCalendarOpen(false);
                          }
                        }}
                        locale={locale === "en-US" ? enUS : ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="space-y-2">
                <Label>{formatMessage("inventory.movements.form.notes")}</Label>
                <Textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(event) => handleFormChange("notes", event.target.value)}
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={closeDrawer}
                >
                  {formatMessage("inventory.movements.drawer.cancel")}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMovement.isPending}
                >
                  {createMovement.isPending ? "Registrando..." : formatMessage("inventory.movements.drawer.save")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </InventoryLayout>
  );
}
