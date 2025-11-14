import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { EntityDrawer } from "@/components/inventory/entity-drawer";
import {
  InventoryProductType,
  useCreateInventoryProductType,
  useDeleteInventoryProductType,
  useInventoryProductTypes,
  useUpdateInventoryProductType,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ProductTypeStatus = "active" | "inactive" | "all";

interface ProductTypeFormState {
  name: string;
  code: string;
  category: string;
  requiresSerial: boolean;
  requiresAsset: boolean;
  isConsumable: boolean;
}

const DEFAULT_PRODUCT_TYPE_FORM: ProductTypeFormState = {
  name: "",
  code: "",
  category: "hardware",
  requiresSerial: false,
  requiresAsset: false,
  isConsumable: false,
};

const CATEGORY_OPTIONS = ["hardware", "software", "accessory", "service", "other"];

export default function InventoryProductTypesPage() {
  const { formatMessage } = useI18n();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<ProductTypeStatus>("active");
  const [search, setSearch] = useState("");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<ProductTypeFormState>(DEFAULT_PRODUCT_TYPE_FORM);
  const [editingType, setEditingType] = useState<InventoryProductType | null>(null);

  const productTypesQuery = useInventoryProductTypes({
    includeInactive: statusFilter !== "active",
  });

  const createType = useCreateInventoryProductType();
  const updateType = useUpdateInventoryProductType();
  const deleteType = useDeleteInventoryProductType();

  const productTypes = productTypesQuery.data?.data ?? [];

  const filteredTypes = useMemo(() => {
    return productTypes.filter((type) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? type.is_active !== false
          : type.is_active === false;

      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        type.name?.toLowerCase().includes(term) ||
        type.code?.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [productTypes, search, statusFilter]);

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: search,
      placeholder: formatMessage("inventory.product_types.filters.search"),
      width: 260,
    },
    {
      type: "select",
      key: "status",
      value: statusFilter,
      placeholder: formatMessage("inventory.product_types.filters.status"),
      options: [
        { value: "active", label: formatMessage("inventory.product_types.filters.active") },
        { value: "inactive", label: formatMessage("inventory.product_types.filters.inactive") },
        { value: "all", label: formatMessage("inventory.product_types.filters.all") },
      ],
      width: 200,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    if (key === "search") {
      setSearch(String(value ?? ""));
    }
    if (key === "status") {
      setStatusFilter((value as ProductTypeStatus) ?? "active");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("active");
  };

  const openCreateDrawer = () => {
    setEditingType(null);
    setFormState(DEFAULT_PRODUCT_TYPE_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (type: InventoryProductType) => {
    setEditingType(type);
    setFormState({
      name: type.name ?? "",
      code: type.code ?? "",
      category: type.category ?? "hardware",
      requiresSerial: Boolean(type.requires_serial),
      requiresAsset: Boolean(type.requires_asset_tag),
      isConsumable: Boolean(type.is_consumable),
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingType(null);
    setFormState(DEFAULT_PRODUCT_TYPE_FORM);
  };

  const handleFormChange = (field: keyof ProductTypeFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast({
        title: formatMessage("inventory.product_types.form.validation.name"),
        variant: "destructive",
      });
      return;
    }
    if (!formState.code.trim()) {
      toast({
        title: formatMessage("inventory.product_types.form.validation.code"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      code: formState.code,
      category: formState.category,
      requires_serial: formState.requiresSerial,
      requires_asset_tag: formState.requiresAsset,
      is_consumable: formState.isConsumable,
    };

    if (editingType) {
      updateType.mutate(
        { id: editingType.id, payload },
        {
          onSuccess: closeDrawer,
        }
      );
    } else {
      createType.mutate(payload, {
        onSuccess: closeDrawer,
      });
    }
  };

  const handleDeactivate = (type: InventoryProductType) => {
    const confirmed = window.confirm(
      formatMessage("inventory.product_types.table.confirm_deactivate", { name: type.name })
    );
    if (!confirmed) return;
    deleteType.mutate({ id: type.id });
  };

  const columns: EntityColumn<InventoryProductType>[] = [
    {
      key: "name",
      header: formatMessage("inventory.product_types.table.name"),
      render: (type) => (
        <div className="flex flex-col">
          <span className="font-medium">{type.name}</span>
          <span className="text-xs text-muted-foreground">{type.code}</span>
        </div>
      ),
    },
    {
      key: "category",
      header: formatMessage("inventory.product_types.table.category"),
      render: (type) => formatMessage(`inventory.product_types.categories.${type.category}` as any),
    },
    {
      key: "flags",
      header: formatMessage("inventory.product_types.table.flags"),
      render: (type) => (
        <div className="flex flex-wrap gap-2 text-xs">
          {type.requires_serial && (
            <Badge variant="secondary">
              {formatMessage("inventory.product_types.table.requires_serial")}
            </Badge>
          )}
          {type.requires_asset_tag && (
            <Badge variant="secondary">
              {formatMessage("inventory.product_types.table.requires_asset")}
            </Badge>
          )}
          {type.is_consumable && (
            <Badge variant="secondary">
              {formatMessage("inventory.product_types.table.is_consumable")}
            </Badge>
          )}
          {!type.requires_serial && !type.requires_asset_tag && !type.is_consumable && (
            <span className="text-muted-foreground">--</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: formatMessage("inventory.product_types.table.status"),
      render: (type) => (
        <Badge variant={type.is_active === false ? "outline" : "secondary"}>
          {type.is_active === false
            ? formatMessage("inventory.product_types.table.inactive")
            : formatMessage("inventory.product_types.table.active")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.product_types.table.actions"),
      render: (type) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditDrawer(type)}>
            {formatMessage("inventory.product_types.table.edit")}
          </Button>
          {type.is_active !== false && (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(type)}>
              {formatMessage("inventory.product_types.table.deactivate")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <InventoryLayout
      title={formatMessage("inventory.product_types_title")}
      description={formatMessage("inventory.product_types_description")}
      breadcrumb={[{ label: formatMessage("inventory.product_types_breadcrumb") }]}
      actions={
        <Button onClick={openCreateDrawer}>
          {formatMessage("inventory.product_types.actions.new_type")}
        </Button>
      }
    >
      <div className="space-y-4">
        <InventoryFilterBar
          filters={filterConfigs}
          onChange={handleFilterChange}
          onReset={resetFilters}
          isDirty={Boolean(search) || statusFilter !== "active"}
        />
        <EntityTable
          data={filteredTypes}
          columns={columns}
          isLoading={productTypesQuery.isLoading}
          emptyTitle={formatMessage("inventory.product_types.table.empty_title")}
          emptyDescription={formatMessage("inventory.product_types.table.empty_description")}
        />
      </div>

      <EntityDrawer
        title={
          editingType
            ? formatMessage("inventory.product_types.drawer.edit_title")
            : formatMessage("inventory.product_types.drawer.create_title")
        }
        description={formatMessage("inventory.product_types.drawer.description")}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
        primaryAction={{
          label: formatMessage("inventory.product_types.drawer.save"),
          onClick: handleSubmit,
          loading: createType.isPending || updateType.isPending,
        }}
        secondaryAction={{
          label: formatMessage("inventory.product_types.drawer.cancel"),
          onClick: closeDrawer,
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{formatMessage("inventory.product_types.form.name")}</Label>
            <Input value={formState.name} onChange={(event) => handleFormChange("name", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.product_types.form.code")}</Label>
            <Input value={formState.code} onChange={(event) => handleFormChange("code", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.product_types.form.category")}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none"
              value={formState.category}
              onChange={(event) => handleFormChange("category", event.target.value)}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {formatMessage(`inventory.product_types.categories.${category}` as any)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {formatMessage("inventory.product_types.form.requires_serial")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMessage("inventory.product_types.form.requires_serial_hint")}
                </p>
              </div>
              <Switch
                checked={formState.requiresSerial}
                onCheckedChange={(value) => handleFormChange("requiresSerial", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  {formatMessage("inventory.product_types.form.requires_asset")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMessage("inventory.product_types.form.requires_asset_hint")}
                </p>
              </div>
              <Switch
                checked={formState.requiresAsset}
                onCheckedChange={(value) => handleFormChange("requiresAsset", value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
              <div>
                <p className="text-sm font-medium">
                  {formatMessage("inventory.product_types.form.is_consumable")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMessage("inventory.product_types.form.is_consumable_hint")}
                </p>
              </div>
              <Switch
                checked={formState.isConsumable}
                onCheckedChange={(value) => handleFormChange("isConsumable", value)}
              />
            </div>
          </div>
        </div>
      </EntityDrawer>
    </InventoryLayout>
  );
}

