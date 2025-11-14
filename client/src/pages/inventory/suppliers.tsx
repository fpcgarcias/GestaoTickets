import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { EntityDrawer } from "@/components/inventory/entity-drawer";
import {
  InventorySupplier,
  useCreateInventorySupplier,
  useDeleteInventorySupplier,
  useInventorySuppliers,
  useUpdateInventorySupplier,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SupplierFormState {
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
}

const DEFAULT_SUPPLIER_FORM: SupplierFormState = {
  name: "",
  cnpj: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

type SupplierStatusFilter = "active" | "inactive" | "all";

export default function InventorySuppliersPage() {
  const { formatMessage } = useI18n();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("active");
  const [search, setSearch] = useState("");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<SupplierFormState>(DEFAULT_SUPPLIER_FORM);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);

  const suppliersQuery = useInventorySuppliers({
    includeInactive: statusFilter !== "active",
  });

  const createSupplier = useCreateInventorySupplier();
  const updateSupplier = useUpdateInventorySupplier();
  const deleteSupplier = useDeleteInventorySupplier();

  const suppliers = (suppliersQuery.data?.data ?? []) as InventorySupplier[];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? supplier.is_active !== false
          : supplier.is_active === false;

      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        supplier.name?.toLowerCase().includes(term) ||
        supplier.cnpj?.replace(/\D/g, "").includes(term.replace(/\D/g, ""));

      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, suppliers]);

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: search,
      placeholder: formatMessage("inventory.suppliers.filters.search"),
      width: 260,
    },
    {
      type: "select",
      key: "status",
      value: statusFilter,
      placeholder: formatMessage("inventory.suppliers.filters.status"),
      options: [
        { value: "active", label: formatMessage("inventory.suppliers.filters.active") },
        { value: "inactive", label: formatMessage("inventory.suppliers.filters.inactive") },
        { value: "all", label: formatMessage("inventory.suppliers.filters.all") },
      ],
      width: 200,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    if (key === "search") {
      setSearch(String(value ?? ""));
    }
    if (key === "status") {
      setStatusFilter((value as SupplierStatusFilter) ?? "active");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("active");
  };

  const openCreateDrawer = () => {
    setEditingSupplier(null);
    setFormState(DEFAULT_SUPPLIER_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (supplier: InventorySupplier) => {
    setEditingSupplier(supplier);
    setFormState({
      name: supplier.name ?? "",
      cnpj: supplier.cnpj ?? "",
      contactName: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingSupplier(null);
    setFormState(DEFAULT_SUPPLIER_FORM);
  };

  const handleFormChange = (field: keyof SupplierFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast({
        title: formatMessage("inventory.suppliers.form.validation.name"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      cnpj: formState.cnpj || undefined,
      contact_name: formState.contactName || undefined,
      email: formState.email || undefined,
      phone: formState.phone || undefined,
      notes: formState.notes || undefined,
    };

    if (editingSupplier) {
      updateSupplier.mutate(
        { id: editingSupplier.id, payload },
        {
          onSuccess: closeDrawer,
        }
      );
    } else {
      createSupplier.mutate(payload, {
        onSuccess: closeDrawer,
      });
    }
  };

  const handleDeactivate = (supplier: InventorySupplier) => {
    const confirmed = window.confirm(
      formatMessage("inventory.suppliers.table.confirm_deactivate", { name: supplier.name })
    );
    if (!confirmed) return;
    deleteSupplier.mutate({ id: supplier.id });
  };

  const columns: EntityColumn<InventorySupplier>[] = [
    {
      key: "name",
      header: formatMessage("inventory.suppliers.table.name"),
      render: (supplier) => (
        <div className="flex flex-col">
          <span className="font-medium">{supplier.name}</span>
          {supplier.contact_name && (
            <span className="text-xs text-muted-foreground">
              {formatMessage("inventory.suppliers.table.contact_prefix")} {supplier.contact_name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "cnpj",
      header: formatMessage("inventory.suppliers.table.cnpj"),
      render: (supplier) => supplier.cnpj ?? "--",
    },
    {
      key: "phone",
      header: formatMessage("inventory.suppliers.table.phone"),
      render: (supplier) => supplier.phone ?? "--",
    },
    {
      key: "email",
      header: formatMessage("inventory.suppliers.table.email"),
      render: (supplier) => supplier.email ?? "--",
    },
    {
      key: "status",
      header: formatMessage("inventory.suppliers.table.status"),
      render: (supplier) => (
        <Badge variant={supplier.is_active === false ? "outline" : "secondary"}>
          {supplier.is_active === false
            ? formatMessage("inventory.suppliers.table.inactive")
            : formatMessage("inventory.suppliers.table.active")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.suppliers.table.actions"),
      render: (supplier) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEditDrawer(supplier)}>
            {formatMessage("inventory.suppliers.table.edit")}
          </Button>
          {supplier.is_active !== false && (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(supplier)}>
              {formatMessage("inventory.suppliers.table.deactivate")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <InventoryLayout
      title={formatMessage("inventory.suppliers_title")}
      description={formatMessage("inventory.suppliers_description")}
      breadcrumb={[{ label: formatMessage("inventory.suppliers_breadcrumb") }]}
      actions={
        <Button onClick={openCreateDrawer}>
          {formatMessage("inventory.suppliers.actions.new_supplier")}
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
          data={filteredSuppliers}
          columns={columns}
          isLoading={suppliersQuery.isLoading}
          emptyTitle={formatMessage("inventory.suppliers.table.empty_title")}
          emptyDescription={formatMessage("inventory.suppliers.table.empty_description")}
        />
      </div>

      <EntityDrawer
        title={
          editingSupplier
            ? formatMessage("inventory.suppliers.drawer.edit_title")
            : formatMessage("inventory.suppliers.drawer.create_title")
        }
        description={formatMessage("inventory.suppliers.drawer.description")}
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
        primaryAction={{
          label: formatMessage("inventory.suppliers.drawer.save"),
          onClick: handleSubmit,
          loading: createSupplier.isPending || updateSupplier.isPending,
        }}
        secondaryAction={{
          label: formatMessage("inventory.suppliers.drawer.cancel"),
          onClick: closeDrawer,
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{formatMessage("inventory.suppliers.form.name")}</Label>
            <Input value={formState.name} onChange={(event) => handleFormChange("name", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.suppliers.form.cnpj")}</Label>
            <Input value={formState.cnpj} onChange={(event) => handleFormChange("cnpj", event.target.value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{formatMessage("inventory.suppliers.form.contact_name")}</Label>
              <Input
                value={formState.contactName}
                onChange={(event) => handleFormChange("contactName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{formatMessage("inventory.suppliers.form.phone")}</Label>
              <Input value={formState.phone} onChange={(event) => handleFormChange("phone", event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.suppliers.form.email")}</Label>
            <Input value={formState.email} onChange={(event) => handleFormChange("email", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{formatMessage("inventory.suppliers.form.notes")}</Label>
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

