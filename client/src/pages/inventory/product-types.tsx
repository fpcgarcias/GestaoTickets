import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DepartmentOption {
  id: number;
  name: string;
}

type ProductTypeStatus = "active" | "inactive" | "all";

interface ProductTypeFormState {
  name: string;
  categoryId: string; // ID da categoria (numérico)
  departmentId: string;
}

const DEFAULT_PRODUCT_TYPE_FORM: ProductTypeFormState = {
  name: "",
  categoryId: "",
  departmentId: "",
};

const generateCode = (name: string) => {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const fallback = `type_${Date.now()}`;
  return normalized || fallback;
};

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

  // Buscar departamentos disponíveis
  const departmentsQuery = useQuery<DepartmentOption[]>({
    queryKey: ["inventory-departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments?active_only=true&limit=200");
      const data = await response.json();
      return (data?.departments ?? data?.data ?? []) as DepartmentOption[];
    },
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Buscar categorias disponíveis
  const categoriesQuery = useQuery<any[]>({
    queryKey: ["inventory", "product-categories", { includeInactive: false }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/product-categories");
      const data = await response.json();
      return data?.data ?? [];
    },
    select: (data) => Array.isArray(data) ? data : [],
  });

  const productTypes = Array.isArray(productTypesQuery.data?.data) ? productTypesQuery.data!.data : [];
  const _departments = departmentsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

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
      categoryId: (type as any).category_id ? String((type as any).category_id) : "",
      departmentId: (type as any).department_id ? String((type as any).department_id) : "",
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

    if (!formState.categoryId) {
      toast({
        title: "Selecione uma categoria",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      code: editingType?.code ?? generateCode(formState.name),
      category_id: parseInt(formState.categoryId, 10),
      department_id: formState.departmentId ? parseInt(formState.departmentId, 10) : undefined,
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
      render: (type) => {
        const categoryId = (type as any).category_id;
        const category = categories.find((cat: any) => cat.id === categoryId);
        if (category) {
          return (
            <div className="flex items-center gap-2">
              {category.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
              )}
              <span>{category.name}</span>
            </div>
          );
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "status",
      header: formatMessage("inventory.product_types.table.status"),
      render: (type) => (
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
            type.is_active === false ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800"
          )}
        >
          {type.is_active === false
            ? formatMessage("inventory.product_types.table.inactive")
            : formatMessage("inventory.product_types.table.active")}
        </span>
      ),
    },
    {
      key: "actions",
      header: formatMessage("inventory.product_types.table.actions"),
      render: (type) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openEditDrawer(type)}
            title={formatMessage("inventory.product_types.table.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {type.is_active !== false && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleDeactivate(type)}
              title={formatMessage("inventory.product_types.table.deactivate")}
            >
              <Trash className="h-3.5 w-3.5" />
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
              {editingType
                ? formatMessage("inventory.product_types.drawer.edit_title")
                : formatMessage("inventory.product_types.drawer.create_title")}
            </DialogTitle>
            <DialogDescription>{formatMessage("inventory.product_types.drawer.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{formatMessage("inventory.product_types.form.name")}</Label>
              <Input value={formState.name} onChange={(event) => handleFormChange("name", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={formState.categoryId}
                onValueChange={(value) => handleFormChange("categoryId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Departamento REMOVIDO dos tipos; regras ficam na categoria */}
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeDrawer}>
              {formatMessage("inventory.product_types.drawer.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={createType.isPending || updateType.isPending}>
              {formatMessage("inventory.product_types.drawer.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InventoryLayout>
  );
}

