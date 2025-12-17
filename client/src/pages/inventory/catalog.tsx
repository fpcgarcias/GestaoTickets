import { useCallback, useMemo, useState } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Pencil, Plus, Trash } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { ImportNfeButton } from "@/components/inventory/import-nfe-button";
import { NfeBatchImportDialog } from "@/components/inventory/nfe-batch-import-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  InventoryNfeParseResult,
  InventoryProduct,
  InventorySupplier,
  useCreateInventoryProduct,
  useDeleteInventoryProduct,
  useInventoryLocations,
  useInventoryProductCategories,
  useInventoryProductTypes,
  useInventoryProducts,
  useInventorySuppliers,
  useUpdateInventoryProduct,
} from "@/hooks/useInventoryApi";
import { InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { apiRequest } from "@/lib/queryClient";

interface ProductFormState {
  name: string;
  status: string;
  productTypeId: string;
  supplierId: string;
  serialNumber: string;
  serviceTag: string;
  assetNumber: string;
  purchaseValue: string;
  departmentId: string;
  locationId: string;
  invoiceNumber: string;
  purchaseDate: string;
  warrantyDate: string;
  notes: string;
}

interface DepartmentOption {
  id: number;
  name: string;
}

const DEFAULT_FORM: ProductFormState = {
  name: "",
  status: "available",
  productTypeId: "",
  supplierId: "",
  serialNumber: "",
  serviceTag: "",
  assetNumber: "",
  purchaseValue: "",
  departmentId: "",
  locationId: "",
  invoiceNumber: "",
  purchaseDate: "",
  warrantyDate: "",
  notes: "",
};

const NOTES_FIELD_ID = "inventory-catalog-notes";

export default function InventoryCatalogPage() {
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filters, setFilters] = useState<{
    search: string;
    status: string;
    productTypeId: string;
    supplierId: string;
    departmentId: string;
    locationId: string;
    purchaseDateRange?: DateRange;
  }>({
    search: "",
    status: "",
    productTypeId: "",
    supplierId: "",
    departmentId: "",
    locationId: "",
    purchaseDateRange: undefined,
  });

  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(DEFAULT_FORM);
  const [batchImportDialogOpen, setBatchImportDialogOpen] = useState(false);
  const [nfeDataForBatch, setNfeDataForBatch] = useState<InventoryNfeParseResult | null>(null);

  const productFilters = useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.status || undefined,
      product_type_id: filters.productTypeId ? Number(filters.productTypeId) : undefined,
      supplier_id: filters.supplierId ? Number(filters.supplierId) : undefined,
      department_id: filters.departmentId ? Number(filters.departmentId) : undefined,
      location_id: filters.locationId ? Number(filters.locationId) : undefined,
      page,
      limit: pageSize,
    }),
    [filters, page, pageSize]
  );

  const productsQuery = useInventoryProducts(productFilters);
  const productTypesQuery = useInventoryProductTypes();
  const suppliersQuery = useInventorySuppliers();
  const locationsQuery = useInventoryLocations();
  const createProductMutation = useCreateInventoryProduct();
  const updateProductMutation = useUpdateInventoryProduct();
  const deleteProductMutation = useDeleteInventoryProduct();

  const departmentsQuery = useQuery({
    queryKey: ["inventory-departments"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/departments?active_only=true&limit=200"
      );
      const data = await response.json();
      return (data.departments ?? data.data ?? []) as DepartmentOption[];
    },
  });

  const suppliers = (suppliersQuery.data?.data ?? []) as InventorySupplier[];
  const productTypes = productTypesQuery.data?.data ?? [];
  const locations = locationsQuery.data?.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const supplierMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );
  const productTypeMap = useMemo(
    () => new Map(productTypes.map((type) => [type.id, type])),
    [productTypes]
  );
  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  );
  const departmentMap = useMemo(
    () => new Map(departments.map((dept) => [dept.id, dept])),
    [departments]
  );

  const statusOptions = useMemo(
    () => [
      { label: formatMessage("inventory.status.available"), value: "available" },
      { label: formatMessage("inventory.status.in_use"), value: "in_use" },
      { label: formatMessage("inventory.status.maintenance"), value: "maintenance" },
      { label: formatMessage("inventory.status.reserved"), value: "reserved" },
      { label: formatMessage("inventory.status.written_off"), value: "written_off" },
    ],
    [formatMessage]
  );

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: filters.search,
      placeholder: formatMessage("inventory.catalog.filters.search"),
      width: 260,
    },
    {
      type: "select",
      key: "status",
      value: filters.status,
      placeholder: formatMessage("inventory.catalog.filters.status"),
      options: statusOptions,
      width: 200,
    },
    {
      type: "select",
      key: "productTypeId",
      value: filters.productTypeId,
      placeholder: formatMessage("inventory.catalog.filters.product_type"),
      options: productTypes.map((type) => ({
        label: type.name,
        value: String(type.id),
      })),
      width: 220,
    },
    {
      type: "select",
      key: "supplierId",
      value: filters.supplierId,
      placeholder: formatMessage("inventory.catalog.filters.supplier"),
      options: suppliers.map((supplier) => ({
        label: supplier.name,
        value: String(supplier.id),
      })),
      width: 220,
    },
    {
      type: "select",
      key: "departmentId",
      value: filters.departmentId,
      placeholder: formatMessage("inventory.catalog.filters.department"),
      options: departments.map((dept) => ({
        label: dept.name,
        value: String(dept.id),
      })),
      width: 200,
    },
    {
      type: "select",
      key: "locationId",
      value: filters.locationId,
      placeholder: formatMessage("inventory.catalog.filters.location"),
      options: locations.map((location) => ({
        label: location.name,
        value: String(location.id),
      })),
      width: 200,
    },
    {
      type: "date-range",
      key: "purchaseDateRange",
      value: filters.purchaseDateRange,
      placeholder: formatMessage("inventory.catalog.filters.purchase_date"),
      width: 260,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    setPage(1);
    setFilters((prev) => {
      if (key === "purchaseDateRange") {
        return { ...prev, purchaseDateRange: value as DateRange | undefined };
      }
      return {
        ...prev,
        [key]: typeof value === "string" ? value : "",
      };
    });
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      status: "",
      productTypeId: "",
      supplierId: "",
      departmentId: "",
      locationId: "",
      purchaseDateRange: undefined,
    });
    setPage(1);
  };

  const isFiltersDirty =
    !!filters.search ||
    !!filters.status ||
    !!filters.productTypeId ||
    !!filters.supplierId ||
    !!filters.departmentId ||
    !!filters.locationId ||
    !!filters.purchaseDateRange?.from ||
    !!filters.purchaseDateRange?.to;

  const rawProducts = productsQuery.data?.data ?? [];

  const filteredProducts = useMemo(() => {
    if (!filters.purchaseDateRange?.from && !filters.purchaseDateRange?.to) {
      return rawProducts;
    }
    return rawProducts.filter((product) => {
      if (!product.invoice_date) return false;
      const purchaseDate = new Date(product.invoice_date);
      const from = filters.purchaseDateRange?.from;
      const to = filters.purchaseDateRange?.to;
      if (from && purchaseDate < from) return false;
      if (to && purchaseDate > to) return false;
      return true;
    });
  }, [rawProducts, filters.purchaseDateRange]);

  const selectedProductType = useMemo(() => {
    if (!productForm.productTypeId) return null;
    const typeId = Number(productForm.productTypeId);
    return productTypes.find((type) => type.id === typeId) ?? null;
  }, [productForm.productTypeId, productTypes]);

  // Carregar categorias para resolver flags via categoria do tipo
  const categoriesQuery = useInventoryProductCategories();
  const categoryMap = useMemo(() => {
    const list = categoriesQuery.data?.data ?? [];
    return new Map(list.map((c: any) => [c.id, c]));
  }, [categoriesQuery.data]);
  const selectedCategory = selectedProductType ? categoryMap.get((selectedProductType as any).category_id) : undefined;
  const requiresSerial = Boolean(selectedCategory?.requires_serial);
  const requiresAssetTag = Boolean(selectedCategory?.requires_asset_tag);

  const paginationInfo = productsQuery.data?.pagination;
  const totalItems = paginationInfo?.total ?? filteredProducts.length;

  const formatDateValue = useCallback(
    (value?: string | null) => {
      if (!value) return "--";
      // Pegar apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
      const dateOnly = value.slice(0, 10);
      const [year, month, day] = dateOnly.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month é 0-indexed
      return format(date, locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy");
    },
    [locale]
  );

  const formatMoneyForInput = useCallback(
    (raw?: string | null): string => {
      if (!raw) return "";
      const normalized = raw.replace(",", ".").replace(/\s/g, "");
      const numeric = Number(normalized);
      if (Number.isNaN(numeric)) {
        return raw;
      }
      return new Intl.NumberFormat(locale === "en-US" ? "en-US" : "pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    },
    [locale]
  );

  const openCreateDrawer = () => {
    setEditingProduct(null);
    setProductForm({ ...DEFAULT_FORM });
    setDrawerOpen(true);
  };

  const mapProductToForm = (product: InventoryProduct): ProductFormState => ({
    name: product.name ?? "",
    status: product.status ?? "available",
    productTypeId: product.product_type_id ? String(product.product_type_id) : "",
    supplierId: product.supplier_id ? String(product.supplier_id) : "",
    serialNumber: product.serial_number ?? "",
    serviceTag: product.service_tag ?? "",
    assetNumber: product.asset_number ?? "",
    purchaseValue: formatMoneyForInput(product.purchase_value as any),
    departmentId: product.department_id ? String(product.department_id) : "",
    locationId: product.location_id ? String(product.location_id) : "",
    invoiceNumber: product.invoice_number ?? "",
    purchaseDate: product.purchase_date ? product.purchase_date.slice(0, 10) : "",
    warrantyDate: product.warranty_expiry ? product.warranty_expiry.slice(0, 10) : "",
    notes: product.notes ?? "",
  });

  const openEditDrawer = (product: InventoryProduct) => {
    setEditingProduct(product);
    setProductForm(mapProductToForm(product));
    setDrawerOpen(true);
  };

  const resetDrawerState = () => {
    setEditingProduct(null);
    setProductForm({ ...DEFAULT_FORM });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetDrawerState();
  };

  const handleFormChange = (field: keyof ProductFormState, value: string) => {
    setProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = () => {
    if (!productForm.name.trim()) {
      toast({
        title: formatMessage("inventory.catalog.form.validation.name"),
        variant: "destructive",
      });
      return;
    }
    if (!productForm.productTypeId) {
      toast({
        title: formatMessage("inventory.catalog.form.validation.product_type"),
        variant: "destructive",
      });
      return;
    }
    if (requiresSerial && !productForm.serialNumber.trim()) {
      toast({
        title: formatMessage("inventory.catalog.form.validation.serial_required"),
        variant: "destructive",
      });
      return;
    }
    if (requiresAssetTag && !productForm.assetNumber.trim()) {
      toast({
        title: formatMessage("inventory.catalog.form.validation.asset_required"),
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: productForm.name,
      status: productForm.status,
      product_type_id: Number(productForm.productTypeId),
      supplier_id: productForm.supplierId ? Number(productForm.supplierId) : undefined,
      serial_number: productForm.serialNumber || undefined,
      service_tag: productForm.serviceTag || undefined,
      asset_number: productForm.assetNumber || undefined,
      purchase_value: productForm.purchaseValue || undefined,
      department_id: productForm.departmentId ? Number(productForm.departmentId) : undefined,
      location_id: productForm.locationId ? Number(productForm.locationId) : undefined,
      invoice_number: productForm.invoiceNumber || undefined,
      // campos de data exatamente como existem no banco
      purchase_date: productForm.purchaseDate || undefined,
      warranty_expiry: productForm.warrantyDate || undefined,
      notes: productForm.notes || undefined,
    };

    console.log('====== FRONTEND - PAYLOAD SENDO ENVIADO ======');
    console.log('productForm.purchaseDate:', productForm.purchaseDate);
    console.log('productForm.warrantyDate:', productForm.warrantyDate);
    console.log('payload.purchase_date:', payload.purchase_date);
    console.log('payload.warranty_expiry:', payload.warranty_expiry);
    console.log('Payload completo:', payload);

    if (editingProduct) {
      updateProductMutation.mutate(
        { id: editingProduct.id, payload },
        {
          onSuccess: closeDrawer,
        }
      );
    } else {
      createProductMutation.mutate(payload, {
        onSuccess: closeDrawer,
      });
    }
  };

  const handleDeactivateProduct = (product: InventoryProduct) => {
    const confirmed = window.confirm(
      formatMessage("inventory.catalog.table.confirm_deactivate", {
        name: product.name ?? `#${product.id}`,
      })
    );
    if (!confirmed) return;
    deleteProductMutation.mutate({ id: product.id });
  };

  const handleNfeParsed = (parsed: InventoryNfeParseResult) => {
    // Verificar quantidade de produtos
    const productCount = parsed.products?.length ?? 0;
    const firstProduct = parsed.products?.[0];
    const totalQuantity = firstProduct?.quantity ?? 1;

    // Se houver apenas 1 produto ou quantidade = 1, usar fluxo de cadastro único
    if (productCount === 1 && totalQuantity === 1) {
      const supplierDocument = parsed.supplier?.cnpj?.replace(/\D/g, "");
      const matchedSupplier = suppliers.find(
        (supplier) => supplier.cnpj && supplier.cnpj.replace(/\D/g, "") === supplierDocument
      );

      setProductForm((prev) => ({
        ...prev,
        name: firstProduct?.description ?? prev.name,
        supplierId: parsed.supplierId ? String(parsed.supplierId) : (matchedSupplier ? String(matchedSupplier.id) : prev.supplierId),
        invoiceNumber: parsed.invoiceNumber ?? prev.invoiceNumber,
        purchaseDate: parsed.issueDate ? parsed.issueDate.slice(0, 10) : prev.purchaseDate,
        purchaseValue: firstProduct?.unitPrice 
          ? firstProduct.unitPrice.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : prev.purchaseValue,
      }));
      setEditingProduct(null);
      setDrawerOpen(true);
    } else {
      // Se houver múltiplos produtos ou quantidade > 1, usar fluxo de importação em lote
      // Expandir produtos baseado na quantidade
      // IMPORTANTE: Quando expandimos, cada linha = 1 unidade, então não devemos multiplicar unitPrice
      const expandedProducts: typeof parsed.products = [];
      parsed.products?.forEach((product) => {
        const quantity = product.quantity ?? 1;
        const originalUnitPrice = product.unitPrice ?? 0;
        for (let i = 0; i < quantity; i++) {
          expandedProducts.push({
            ...product,
            order: expandedProducts.length + 1,
            quantity: 1, // Cada produto expandido representa 1 unidade
            unitPrice: originalUnitPrice, // Manter o unitPrice original (não multiplicar)
          });
        }
      });

      setNfeDataForBatch({
        ...parsed,
        products: expandedProducts,
      });
      setBatchImportDialogOpen(true);
    }
  };

  const columns: EntityColumn<InventoryProduct>[] = [
    {
      key: "code",
      header: formatMessage("inventory.catalog.table.code"),
      render: (product) => product.id,
    },
    {
      key: "name",
      header: formatMessage("inventory.catalog.table.name"),
      render: (product) => (
        <div className="flex flex-col">
          <span className="font-medium">{product.name}</span>
          {product.serial_number && (
            <span className="text-xs text-muted-foreground">{product.serial_number}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: formatMessage("inventory.catalog.table.status"),
      render: (product) => <InventoryStatusBadge status={product.status} />,
    },
    {
      key: "type",
      header: formatMessage("inventory.catalog.table.product_type"),
      render: (product) => productTypeMap.get(product.product_type_id)?.name ?? "--",
    },
    {
      key: "supplier",
      header: formatMessage("inventory.catalog.table.supplier"),
      render: (product) => supplierMap.get(product.supplier_id)?.name ?? "--",
    },
    {
      key: "location",
      header: formatMessage("inventory.catalog.table.department_location"),
      render: (product) => {
        const department = departmentMap.get(product.department_id)?.name ?? "--";
        const location = locationMap.get(product.location_id)?.name ?? "--";
        return (
          <div className="flex flex-col text-sm">
            <span>{department}</span>
            <span className="text-xs text-muted-foreground">{location}</span>
          </div>
        );
      },
    },
    {
      key: "warranty",
      header: formatMessage("inventory.catalog.table.warranty"),
      render: (product) => formatDateValue(product.warranty_expiry),
    },
    {
      key: "actions",
      header: formatMessage("inventory.catalog.table.actions"),
      render: (product) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => openEditDrawer(product)}
            title={formatMessage("inventory.catalog.table.edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleDeactivateProduct(product)}
            title={formatMessage("inventory.catalog.table.deactivate")}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <InventoryLayout
      title={formatMessage("inventory.catalog_title")}
      description={formatMessage("inventory.catalog_description")}
      breadcrumb={[{ label: formatMessage("inventory.catalog_breadcrumb") }]}
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <ImportNfeButton
            label={formatMessage("inventory.catalog.actions.import_nfe")}
            onParsed={handleNfeParsed}
          />
          <Button onClick={openCreateDrawer}>
            <Plus className="mr-2 h-4 w-4" />
            {formatMessage("inventory.catalog.actions.new_product")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <InventoryFilterBar
          filters={filterConfigs}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          isDirty={isFiltersDirty}
        />
        <EntityTable
          data={filteredProducts}
          columns={columns}
          isLoading={productsQuery.isLoading}
          pagination={{
            page: paginationInfo?.page ?? page,
            pageSize,
            totalItems,
            onPageChange: setPage,
          }}
          emptyTitle={formatMessage("inventory.catalog.table.empty_title")}
          emptyDescription={formatMessage("inventory.catalog.table.empty_description")}
          onRowClick={openEditDrawer}
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? formatMessage("inventory.catalog.drawer.edit_title")
                : formatMessage("inventory.catalog.drawer.create_title")}
            </DialogTitle>
            <DialogDescription>{formatMessage("inventory.catalog.drawer.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-semibold">
                {formatMessage("inventory.catalog.form.identification")}
              </h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.name")}</Label>
                  <Input
                    value={productForm.name}
                    onChange={(event) => handleFormChange("name", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.status")}</Label>
                  <Select value={productForm.status} onValueChange={(value) => handleFormChange("status", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.product_type")}</Label>
                  <Select
                    value={productForm.productTypeId}
                    onValueChange={(value) => handleFormChange("productTypeId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={formatMessage("inventory.catalog.form.product_type_placeholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes.map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.supplier")}</Label>
                  <Select
                    value={productForm.supplierId}
                    onValueChange={(value) => handleFormChange("supplierId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage("inventory.catalog.form.supplier_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold">
                {formatMessage("inventory.catalog.form.fiscal")}
              </h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {formatMessage("inventory.catalog.form.serial_number")}
                    {requiresSerial && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    value={productForm.serialNumber}
                    onChange={(event) => handleFormChange("serialNumber", event.target.value)}
                    required={requiresSerial}
                  />
                  {requiresSerial && (
                    <p className="text-xs text-muted-foreground">
                      {formatMessage("inventory.catalog.form.serial_required_hint")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.service_tag")}</Label>
                  <Input
                    value={productForm.serviceTag}
                    onChange={(event) => handleFormChange("serviceTag", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    {formatMessage("inventory.catalog.form.asset_number")}
                    {requiresAssetTag && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    value={productForm.assetNumber}
                    onChange={(event) => handleFormChange("assetNumber", event.target.value)}
                    required={requiresAssetTag}
                  />
                  {requiresAssetTag && (
                    <p className="text-xs text-muted-foreground">
                      {formatMessage("inventory.catalog.form.asset_required_hint")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.invoice_number")}</Label>
                  <Input
                    value={productForm.invoiceNumber}
                    onChange={(event) => handleFormChange("invoiceNumber", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.purchase_value")}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {locale === "pt-BR" ? "R$" : "U$"}
                    </span>
                    <Input
                      value={productForm.purchaseValue}
                      onChange={(event) => handleFormChange("purchaseValue", event.target.value)}
                      placeholder={locale === "pt-BR" ? "Ex.: 1.234,56" : "e.g. 1,234.56"}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.purchase_date")}</Label>
                  <Input
                    type="date"
                    value={productForm.purchaseDate}
                    onChange={(event) => handleFormChange("purchaseDate", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.warranty_date")}</Label>
                  <Input
                    type="date"
                    value={productForm.warrantyDate}
                    onChange={(event) => handleFormChange("warrantyDate", event.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  {formatMessage("inventory.catalog.nfe.helper")}
                </p>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold">
                {formatMessage("inventory.catalog.form.location_section")}
              </h4>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.department")}</Label>
                  <Select
                    value={productForm.departmentId}
                    onValueChange={(value) => handleFormChange("departmentId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage("inventory.catalog.form.department_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{formatMessage("inventory.catalog.form.location")}</Label>
                  <Select
                    value={productForm.locationId}
                    onValueChange={(value) => handleFormChange("locationId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formatMessage("inventory.catalog.form.location_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold">
                {formatMessage("inventory.catalog.form.notes_section")}
              </h4>
              <div className="mt-3 grid gap-4">
                <div className="space-y-2">
                  <Label className="sr-only" htmlFor={NOTES_FIELD_ID}>
                    {formatMessage("inventory.catalog.form.notes")}
                  </Label>
                  <Textarea
                    id={NOTES_FIELD_ID}
                    rows={4}
                    value={productForm.notes}
                    onChange={(event) => handleFormChange("notes", event.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeDrawer}>
              {formatMessage("inventory.catalog.drawer.cancel")}
            </Button>
            <Button
              onClick={handleFormSubmit}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
            >
              {formatMessage("inventory.catalog.drawer.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NfeBatchImportDialog
        open={batchImportDialogOpen}
        onOpenChange={setBatchImportDialogOpen}
        nfeData={nfeDataForBatch}
      />
    </InventoryLayout>
  );
}

