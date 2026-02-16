import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import {
  InventoryProductCategory,
  useInventoryProductCategories,
  useCreateInventoryProductCategory,
  useUpdateInventoryProductCategory,
  useDeleteInventoryProductCategory,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

type CategoryStatus = "active" | "inactive" | "all";

interface CategoryFormState {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  departmentId: string;
  isConsumable: boolean;
  requiresSerial: boolean;
  requiresAssetTag: boolean;
  minStockAlert: string;
}

const DEFAULT_CATEGORY_FORM: CategoryFormState = {
  name: "",
  code: "",
  description: "",
  icon: "",
  color: "#6B7280",
  departmentId: "",
  isConsumable: false,
  requiresSerial: false,
  requiresAssetTag: false,
  minStockAlert: "",
};

const generateCode = (name: string) => {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const fallback = `cat_${Date.now()}`;
  return normalized || fallback;
};

const COLOR_PRESETS = [
  { name: "Cinza", value: "#6B7280" },
  { name: "Azul", value: "#3B82F6" },
  { name: "Verde", value: "#10B981" },
  { name: "Amarelo", value: "#F59E0B" },
  { name: "Roxo", value: "#8B5CF6" },
  { name: "Vermelho", value: "#EF4444" },
  { name: "Ciano", value: "#06B6D4" },
  { name: "Rosa", value: "#EC4899" },
];

export default function InventoryProductCategoriesPage() {
  const { formatMessage: _formatMessage } = useI18n();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<CategoryStatus>("active");
  const [search, setSearch] = useState("");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState<CategoryFormState>(DEFAULT_CATEGORY_FORM);
  const [editingCategory, setEditingCategory] = useState<InventoryProductCategory | null>(null);

  const categoriesQuery = useInventoryProductCategories({
    includeInactive: statusFilter !== "active",
  });

  const createCategory = useCreateInventoryProductCategory();
  const updateCategory = useUpdateInventoryProductCategory();
  const deleteCategory = useDeleteInventoryProductCategory();

  // Buscar departamentos disponíveis
  const departmentsQuery = useQuery({
    queryKey: ["inventory-departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments?active_only=true&limit=200");
      const data = await response.json();
      return (data.departments ?? data.data ?? []) as DepartmentOption[];
    },
  });

  const categories = categoriesQuery.data?.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? category.is_active !== false
          : category.is_active === false;

      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        category.name?.toLowerCase().includes(term) ||
        category.code?.toLowerCase().includes(term) ||
        category.description?.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [categories, search, statusFilter]);

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: search,
      placeholder: "Buscar por nome, código ou descrição",
      width: 300,
    },
    {
      type: "select",
      key: "status",
      value: statusFilter,
      placeholder: "Status",
      options: [
        { value: "active", label: "Ativas" },
        { value: "inactive", label: "Inativas" },
        { value: "all", label: "Todas" },
      ],
      width: 150,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    if (key === "search") {
      setSearch(String(value ?? ""));
    }
    if (key === "status") {
      setStatusFilter((value as CategoryStatus) ?? "active");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("active");
  };

  const openCreateDrawer = () => {
    setEditingCategory(null);
    setFormState(DEFAULT_CATEGORY_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = (category: InventoryProductCategory) => {
    setEditingCategory(category);
    setFormState({
      name: category.name ?? "",
      code: category.code ?? "",
      description: category.description ?? "",
      icon: category.icon ?? "",
      color: category.color ?? "#6B7280",
      departmentId: category.department_id ? String(category.department_id) : "",
      isConsumable: Boolean((category as any).is_consumable),
      requiresSerial: Boolean((category as any).requires_serial),
      requiresAssetTag: Boolean((category as any).requires_asset_tag),
      minStockAlert: (category as any).min_stock_alert ? String((category as any).min_stock_alert) : "",
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingCategory(null);
    setFormState(DEFAULT_CATEGORY_FORM);
  };

  const handleFormChange = (field: keyof CategoryFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast({
        title: "Nome da categoria é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: formState.name,
      code: formState.code || generateCode(formState.name),
      description: formState.description || undefined,
      icon: formState.icon || undefined,
      color: formState.color,
      department_id: formState.departmentId ? parseInt(formState.departmentId, 10) : undefined,
      is_consumable: formState.isConsumable,
      requires_serial: formState.requiresSerial,
      requires_asset_tag: formState.requiresAssetTag,
      min_stock_alert: formState.minStockAlert ? parseInt(formState.minStockAlert, 10) : undefined,
    };

    if (editingCategory) {
      updateCategory.mutate(
        { id: editingCategory.id, payload },
        {
          onSuccess: closeDrawer,
        }
      );
    } else {
      createCategory.mutate(payload, {
        onSuccess: closeDrawer,
      });
    }
  };

  const handleDeactivate = (category: InventoryProductCategory) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja inativar a categoria "${category.name}"?`
    );
    if (!confirmed) return;
    deleteCategory.mutate({ id: category.id });
  };

  const columns: EntityColumn<InventoryProductCategory>[] = [
    {
      key: "name",
      header: "Nome",
      render: (category) => (
        <div className="flex items-center gap-3">
          {category.color && (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
          )}
          <span className="font-medium">{category.name}</span>
        </div>
      ),
    },
    {
      key: "rules",
      header: "Regras",
      render: (category) => (
        <div className="flex flex-wrap gap-2 text-xs">
          {(category as any).is_consumable && <Badge variant="secondary">Consumível</Badge>}
          {(category as any).requires_serial && <Badge variant="secondary">Exige n° série</Badge>}
          {(category as any).requires_asset_tag && <Badge variant="secondary">Exige patrimônio</Badge>}
          {(category as any).min_stock_alert ? (
            <Badge variant="outline">Estoque min: {(category as any).min_stock_alert}</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "description",
      header: "Descrição",
      render: (category) => (
        <span className="text-sm text-muted-foreground">
          {category.description || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (category) => (
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
            category.is_active === false ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800"
          )}
        >
          {category.is_active === false ? "Inativa" : "Ativa"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      render: (category) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openEditDrawer(category)}
            title="Editar categoria"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {category.is_active !== false && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleDeactivate(category)}
              title="Inativar categoria"
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
      title="Categorias de Produtos"
      description="Gerencie as categorias disponíveis para classificar produtos do inventário."
      breadcrumb={[{ label: "Categorias" }]}
      actions={
        <Button onClick={openCreateDrawer}>
          Nova Categoria
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
          data={filteredCategories}
          columns={columns}
          isLoading={categoriesQuery.isLoading}
          emptyTitle="Nenhuma categoria encontrada"
          emptyDescription="Crie uma nova categoria para começar a organizar seus produtos."
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
              {editingCategory
                ? "Editar Categoria"
                : "Nova Categoria"}
            </DialogTitle>
            <DialogDescription>
              Defina as informações da categoria de produtos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Categoria *</Label>
              <Input
                value={formState.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                placeholder="Ex: Notebook, Toner, Lâmpada, Monitor..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Consumível</p>
                  <p className="text-xs text-muted-foreground">Controla por quantidade</p>
                </div>
                <Switch
                  checked={formState.isConsumable}
                  onCheckedChange={(value) => handleFormChange("isConsumable", value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Exige número de série</p>
                  <p className="text-xs text-muted-foreground">Obrigatório ao cadastrar item</p>
                </div>
                <Switch
                  checked={formState.requiresSerial}
                  onCheckedChange={(value) => handleFormChange("requiresSerial", value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Exige patrimônio</p>
                  <p className="text-xs text-muted-foreground">Obrigatório ao cadastrar item</p>
                </div>
                <Switch
                  checked={formState.requiresAssetTag}
                  onCheckedChange={(value) => handleFormChange("requiresAssetTag", value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select
                value={formState.departmentId || "_global"}
                onValueChange={(value) => handleFormChange("departmentId", value === "_global" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria global (todos os departamentos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_global">Categoria global (todos os departamentos)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para criar uma categoria visível por todos os departamentos
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estoque mínimo (alerta)</Label>
              <Input
                type="number"
                min={0}
                value={formState.minStockAlert}
                onChange={(e) => handleFormChange("minStockAlert", e.target.value)}
                placeholder="Ex: 5"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formState.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                placeholder="Descreva o tipo de produtos desta categoria..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor de Identificação</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleFormChange("color", preset.value)}
                    className={cn(
                      "w-10 h-10 rounded-md border-2 transition-all hover:scale-110",
                      formState.color === preset.value
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeDrawer}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createCategory.isPending || updateCategory.isPending}>
              {editingCategory ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InventoryLayout>
  );
}

