import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Pencil, UserX } from "lucide-react";

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

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (!digits) return "";
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/^(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
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
      cnpj: supplier.cnpj?.replace(/\D/g, "") ?? "",
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
      render: (supplier) => (supplier.cnpj ? formatCnpj(supplier.cnpj) : "--"),
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
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
            supplier.is_active === false
              ? "bg-gray-100 text-gray-800"
              : "bg-green-100 text-green-800"
          )}
        >
          {supplier.is_active === false
            ? formatMessage("inventory.suppliers.table.inactive")
            : formatMessage("inventory.suppliers.table.active")}
        </span>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.suppliers.table.actions"),
      render: (supplier) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openEditDrawer(supplier)}
            title={formatMessage("inventory.suppliers.table.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {supplier.is_active !== false && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0 bg-amber-500 hover:bg-amber-500/90"
              onClick={() => handleDeactivate(supplier)}
              title={formatMessage("inventory.suppliers.table.deactivate")}
            >
              <UserX className="h-3.5 w-3.5" />
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

      <Dialog
        open={isDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDrawer();
          } else {
            setDrawerOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier
                ? formatMessage("inventory.suppliers.drawer.edit_title")
                : formatMessage("inventory.suppliers.drawer.create_title")}
            </DialogTitle>
            <DialogDescription>{formatMessage("inventory.suppliers.drawer.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{formatMessage("inventory.suppliers.form.name")}</Label>
              <Input value={formState.name} onChange={(event) => handleFormChange("name", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{formatMessage("inventory.suppliers.form.cnpj")}</Label>
            <Input
              value={formatCnpj(formState.cnpj)}
                placeholder="00.000.000/0000-00"
              onChange={(event) =>
                handleFormChange("cnpj", event.target.value.replace(/\D/g, "").slice(0, 14))
              }
            />
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
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeDrawer}>
              {formatMessage("inventory.suppliers.drawer.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={createSupplier.isPending || updateSupplier.isPending}>
              {formatMessage("inventory.suppliers.drawer.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InventoryLayout>
  );
}

