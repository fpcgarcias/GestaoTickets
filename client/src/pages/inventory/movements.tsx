import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig, InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { EntityDrawer } from "@/components/inventory/entity-drawer";
import {
  useApproveInventoryMovement,
  useCreateInventoryMovement,
  useInventoryMovements,
  useRejectInventoryMovement,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const MOVEMENT_TYPES = ["entry", "withdrawal", "return", "transfer", "maintenance", "reservation", "write_off"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected"];
const ALL_VALUE = "__all__";

interface MovementFormState {
  productId: string;
  movementType: string;
  quantity: string;
  ticketId: string;
  notes: string;
}

const DEFAULT_FORM: MovementFormState = {
  productId: "",
  movementType: "withdrawal",
  quantity: "1",
  ticketId: "",
  notes: "",
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

  const movements = movementsQuery.data?.data ?? [];
  const paginationInfo = movementsQuery.data?.pagination;
  const totalItems = paginationInfo?.total ?? movements.length;

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

  const handleFormChange = (field: keyof MovementFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formState.productId.trim()) {
      toast({
        title: formatMessage("inventory.movements.form.validation.product"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      product_id: Number(formState.productId),
      movement_type: formState.movementType,
      quantity: Number(formState.quantity) || 1,
      ticket_id: formState.ticketId ? Number(formState.ticketId) : undefined,
      notes: formState.notes || undefined,
    };

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
    const date = new Date(value);
    return format(date, locale === "en-US" ? "MM/dd/yyyy HH:mm" : "dd/MM/yyyy HH:mm");
  };

  const columns: EntityColumn<any>[] = useMemo(
    () => [
      {
        key: "id",
        header: formatMessage("inventory.movements.table.id"),
        render: (movement) => `#${movement.id}`,
      },
      {
        key: "product",
        header: formatMessage("inventory.movements.table.product"),
        render: (movement) => (
          <div className="flex flex-col">
            <span className="font-medium">#{movement.product_id}</span>
            {movement.product?.name && (
              <span className="text-xs text-muted-foreground">{movement.product.name}</span>
            )}
          </div>
        ),
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
        render: (movement) => movement.quantity ?? 1,
      },
      {
        key: "ticket",
        header: formatMessage("inventory.movements.table.ticket"),
        render: (movement) => (movement.ticket_id ? `#${movement.ticket_id}` : "--"),
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
          <div className="flex gap-2">
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
          </div>
        ),
      },
    ],
    [formatDateValue, formatMessage]
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

      <EntityDrawer
        title={formatMessage("inventory.movements.drawer.title")}
        description={formatMessage("inventory.movements.drawer.subtitle")}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
        primaryAction={{
          label: formatMessage("inventory.movements.drawer.save"),
          onClick: handleSubmit,
          loading: createMovement.isPending,
        }}
        secondaryAction={{
          label: formatMessage("inventory.movements.drawer.cancel"),
          onClick: closeDrawer,
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{formatMessage("inventory.movements.form.product_id")}</Label>
            <Input
              value={formState.productId}
              onChange={(event) => handleFormChange("productId", event.target.value)}
            />
          </div>
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
          <div className="space-y-2">
            <Label>{formatMessage("inventory.movements.form.notes")}</Label>
            <Textarea
              rows={3}
              value={formState.notes}
              onChange={(event) => handleFormChange("notes", event.target.value)}
            />
          </div>
        </div>
      </EntityDrawer>
    </InventoryLayout>
  );
}
