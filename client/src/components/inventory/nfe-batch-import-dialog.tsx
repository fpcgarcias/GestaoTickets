import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  InventoryNfeParseResult,
  BatchImportProduct,
  useImportInventoryProductsBatch,
  useInventoryProductTypes,
  useInventoryLocations,
  useInventoryProductCategories,
} from "@/hooks/useInventoryApi";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface NfeBatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nfeData: InventoryNfeParseResult | null;
}

interface ProductFormData {
  serialNumber: string;
  serviceTag: string;
  assetNumber: string;
  productTypeId: string;
  departmentId: string;
  locationId: string;
}

export function NfeBatchImportDialog({ open, onOpenChange, nfeData }: NfeBatchImportDialogProps) {
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();
  const batchImportMutation = useImportInventoryProductsBatch();

  const productTypesQuery = useInventoryProductTypes();
  const locationsQuery = useInventoryLocations();
  const categoriesQuery = useInventoryProductCategories();

  const productTypes = productTypesQuery.data?.data ?? [];
  const locations = locationsQuery.data?.data ?? [];
  const categories = categoriesQuery.data?.data ?? [];

  // Carregar departamentos
  const departmentsQuery = useQuery({
    queryKey: ["inventory-departments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/departments?active_only=true&limit=200");
      const data = await response.json();
      return (data.departments ?? data.data ?? []) as Array<{ id: number; name: string }>;
    },
  });

  const departments = departmentsQuery.data ?? [];

  // Estado para dados compartilhados
  const [sharedData, setSharedData] = useState({
    productTypeId: "",
    departmentId: "",
    locationId: "",
  });

  // Estado para dados individuais de cada produto
  const [productsData, setProductsData] = useState<Record<number, ProductFormData>>({});

  useEffect(() => {
    if (nfeData && open) {
      // Inicializar dados compartilhados
      setSharedData({
        productTypeId: "",
        departmentId: "",
        locationId: "",
      });

      // Inicializar dados individuais
      const initialProductsData: Record<number, ProductFormData> = {};
      nfeData.products?.forEach((product, index) => {
        // Preencher service tag automaticamente se for Dell e houver service tags
        // Quando os produtos são expandidos, cada linha representa 1 unidade
        // Então usamos o índice diretamente para mapear as service tags
        const serviceTag = nfeData.serviceTags && nfeData.serviceTags.length > index 
          ? nfeData.serviceTags[index] 
          : "";

        initialProductsData[product.order] = {
          serialNumber: "",
          serviceTag: serviceTag,
          assetNumber: "",
          productTypeId: "",
          departmentId: "",
          locationId: "",
        };
      });
      setProductsData(initialProductsData);
      
      // Debug: verificar se service tags foram extraídas
      console.log('[Batch Import Dialog] Service tags recebidas:', nfeData.serviceTags);
      console.log('[Batch Import Dialog] Total de produtos:', nfeData.products?.length);
      if (nfeData.serviceTags && nfeData.serviceTags.length > 0) {
        console.log('[Batch Import Dialog] Service tags serão mapeadas para produtos:', nfeData.serviceTags);
        console.log('[Batch Import Dialog] Primeiras 3 service tags:', nfeData.serviceTags.slice(0, 3));
      } else {
        console.warn('[Batch Import Dialog] Nenhuma service tag encontrada!');
      }
    }
  }, [nfeData, open]);

  // Verificar se categoria requer serial ou asset tag
  const getCategoryRequirements = (productTypeId: number) => {
    const productType = productTypes.find((pt) => pt.id === productTypeId);
    if (!productType?.category_id) return { requiresSerial: false, requiresAssetTag: false };
    
    const category = categories.find((c) => c.id === productType.category_id);
    return {
      requiresSerial: Boolean(category?.requires_serial),
      requiresAssetTag: Boolean(category?.requires_asset_tag),
    };
  };

  const handleSharedDataChange = (field: keyof typeof sharedData, value: string) => {
    setSharedData((prev) => ({ ...prev, [field]: value }));
    
    // Aplicar aos produtos individuais se não tiverem valor próprio
    setProductsData((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        const order = Number(key);
        if (!updated[order][field as keyof ProductFormData]) {
          updated[order] = { ...updated[order], [field]: value };
        }
      });
      return updated;
    });
  };

  const handleProductDataChange = (order: number, field: keyof ProductFormData, value: string) => {
    setProductsData((prev) => ({
      ...prev,
      [order]: { ...prev[order], [field]: value },
    }));
  };

  const validateAndSubmit = () => {
    if (!nfeData || !nfeData.products || nfeData.products.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum produto encontrado na NF-e",
        variant: "destructive",
      });
      return;
    }

    if (!nfeData.supplierId) {
      toast({
        title: "Erro",
        description: "Fornecedor não identificado",
        variant: "destructive",
      });
      return;
    }

    const batchProducts: BatchImportProduct[] = [];
    const errors: string[] = [];

    nfeData.products.forEach((product, index) => {
      const order = product.order;
      const productData = productsData[order] || {
        serialNumber: "",
        serviceTag: "",
        assetNumber: "",
        productTypeId: sharedData.productTypeId,
        departmentId: sharedData.departmentId,
        locationId: sharedData.locationId,
      };

      // Usar dados compartilhados se não houver dados individuais
      const productTypeId = productData.productTypeId || sharedData.productTypeId;
      const departmentId = productData.departmentId || sharedData.departmentId;
      const locationId = productData.locationId || sharedData.locationId;

      // Validar tipo de produto
      if (!productTypeId) {
        errors.push(`Produto ${index + 1}: Tipo de produto é obrigatório`);
        return;
      }

      // Verificar requisitos da categoria
      const requirements = getCategoryRequirements(Number(productTypeId));
      if (requirements.requiresSerial && !productData.serialNumber.trim()) {
        errors.push(`Produto ${index + 1}: Número de série é obrigatório`);
        return;
      }
      if (requirements.requiresAssetTag && !productData.assetNumber.trim()) {
        errors.push(`Produto ${index + 1}: Placa de patrimônio é obrigatória`);
        return;
      }

      // Calcular valor unitário com impostos proporcionais
      // IMPORTANTE: Quando produtos são expandidos, cada linha = 1 unidade
      const totalProductsValue = (nfeData.products ?? []).reduce((sum, p) => {
        const unitPrice = p.unitPrice ?? 0;
        const quantity = p.quantity ?? 1;
        return sum + (unitPrice * quantity);
      }, 0);
      const totalInvoiceValue = nfeData.totals?.totalInvoice ?? 0;
      const totalTaxes = totalInvoiceValue - totalProductsValue;
      
      // Calcular proporção de impostos para este produto
      const productUnitPrice = product.unitPrice ?? 0;
      const productQuantity = product.quantity ?? 1;
      const productValue = productUnitPrice * productQuantity;
      
      const taxProportion = totalProductsValue > 0 ? (productValue / totalProductsValue) : 0;
      const productTax = totalTaxes * taxProportion;
      
      // Valor unitário final = valor unitário + (imposto / quantity)
      const realUnitPrice = productUnitPrice + (productTax / productQuantity);
      const formattedValue = realUnitPrice.toFixed(2);

      // Formatar data
      const purchaseDate = nfeData.issueDate ? nfeData.issueDate.slice(0, 10) : "";

      batchProducts.push({
        name: product.description || `Produto ${order}`,
        product_type_id: Number(productTypeId),
        supplier_id: nfeData.supplierId!,
        serial_number: productData.serialNumber.trim() || undefined,
        service_tag: productData.serviceTag.trim() || undefined,
        asset_number: productData.assetNumber.trim() || undefined,
        purchase_value: formattedValue,
        department_id: departmentId ? Number(departmentId) : undefined,
        location_id: locationId ? Number(locationId) : undefined,
        invoice_number: nfeData.invoiceNumber || undefined,
        purchase_date: purchaseDate || undefined,
      });
    });

    if (errors.length > 0) {
      toast({
        title: "Erros de validação",
        description: errors.join("; "),
        variant: "destructive",
      });
      return;
    }

    if (batchProducts.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum produto válido para importar",
        variant: "destructive",
      });
      return;
    }

    batchImportMutation.mutate(
      { products: batchProducts },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!nfeData || !nfeData.products || nfeData.products.length === 0) {
    return null;
  }

  const totalProducts = nfeData.products.length;
  const totalInvoiceValue = nfeData.totals?.totalInvoice ?? 0;
  
  // Calcular soma dos valores dos produtos (sem impostos)
  // Quando os produtos são expandidos, cada linha representa 1 unidade
  // Então usamos apenas unitPrice (sem multiplicar por quantity, pois cada linha já é 1 unidade)
  // IMPORTANTE: Se quantity > 1, significa que o produto não foi expandido corretamente
  const totalProductsValue = nfeData.products.reduce((sum, product) => {
    const unitPrice = product.unitPrice ?? 0;
    const quantity = product.quantity ?? 1;
    // Se quantity > 1, o produto não foi expandido, então multiplicamos
    // Se quantity = 1, o produto já foi expandido, então usamos apenas unitPrice
    return sum + (unitPrice * quantity);
  }, 0);
  
  // Calcular diferença (impostos e outros custos)
  const taxesAndOtherCosts = totalInvoiceValue - totalProductsValue;
  const hasSignificantDifference = Math.abs(taxesAndOtherCosts) > 0.01; // Mais de 1 centavo de diferença
  const differencePercentage = totalProductsValue > 0 
    ? ((taxesAndOtherCosts / totalProductsValue) * 100).toFixed(2)
    : "0.00";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Importar {totalProducts} Produto(s) da NF-e</DialogTitle>
          <DialogDescription>
            Preencha os dados individuais para cada produto. Campos marcados com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 overflow-hidden">
          {/* Informações da NF-e */}
          <div className="space-y-3 flex-shrink-0">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <p className="text-sm font-medium">{nfeData.supplier?.name || "--"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número da NF-e</Label>
                <p className="text-sm font-medium">{nfeData.invoiceNumber || "--"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Total da Nota</Label>
                <p className="text-sm font-medium">
                  {totalInvoiceValue.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
                    style: "currency",
                    currency: locale === "en-US" ? "USD" : "BRL",
                  })}
                </p>
              </div>
            </div>

            {/* Breakdown de valores (se houver diferença significativa) */}
            {hasSignificantDifference && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <div className="font-medium">Breakdown de Valores:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor dos Produtos:</span>{" "}
                      <span className="font-medium">
                        {totalProductsValue.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
                          style: "currency",
                          currency: locale === "en-US" ? "USD" : "BRL",
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Impostos e Outros Custos:</span>{" "}
                      <span className="font-medium">
                        {taxesAndOtherCosts.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
                          style: "currency",
                          currency: locale === "en-US" ? "USD" : "BRL",
                        })}
                      </span>
                      <span className="text-muted-foreground ml-1">({differencePercentage}%)</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    O valor unitário será calculado usando o valor total da nota (incluindo impostos) dividido pela quantidade.
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Campos compartilhados */}
          <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg flex-shrink-0">
            <div className="space-y-2">
              <Label>
                Tipo de Produto (compartilhado) <span className="text-destructive">*</span>
              </Label>
              <Select
                value={sharedData.productTypeId}
                onValueChange={(value) => handleSharedDataChange("productTypeId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
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
              <Label>Departamento (compartilhado)</Label>
              <Select
                value={sharedData.departmentId}
                onValueChange={(value) => handleSharedDataChange("departmentId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
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
              <Label>Localização (compartilhada)</Label>
              <Select
                value={sharedData.locationId}
                onValueChange={(value) => handleSharedDataChange("locationId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a localização" />
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

          {/* Tabela de produtos */}
          <div className="flex-1 min-h-0 border rounded-lg overflow-y-auto" style={{ maxHeight: '500px', minHeight: '300px' }}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[200px]">Produto</TableHead>
                  <TableHead className="w-[120px]">Valor Unit.</TableHead>
                  <TableHead className="w-[150px]">
                    Serial <span className="text-destructive">*</span>
                  </TableHead>
                  <TableHead className="w-[150px]">Service Tag</TableHead>
                  <TableHead className="w-[150px]">
                    Patrimônio <span className="text-destructive">*</span>
                  </TableHead>
                  <TableHead className="w-[180px]">Tipo (individual)</TableHead>
                  <TableHead className="w-[150px]">Dept. (individual)</TableHead>
                  <TableHead className="w-[150px]">Loc. (individual)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nfeData.products.map((product) => {
                  const order = product.order;
                  const productData = productsData[order] || {
                    serialNumber: "",
                    serviceTag: "",
                    assetNumber: "",
                    productTypeId: sharedData.productTypeId,
                    departmentId: sharedData.departmentId,
                    locationId: sharedData.locationId,
                  };
                  const productTypeId = productData.productTypeId || sharedData.productTypeId;
                  const requirements = productTypeId ? getCategoryRequirements(Number(productTypeId)) : { requiresSerial: false, requiresAssetTag: false };

                  return (
                    <TableRow key={order}>
                      <TableCell className="font-medium">
                        {product.description || `Produto ${order}`}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Calcular valor unitário com impostos proporcionais
                          // IMPORTANTE: Quando produtos são expandidos, cada linha = 1 unidade
                          const totalProductsValue = (nfeData.products ?? []).reduce((sum, p) => {
                            const unitPrice = p.unitPrice ?? 0;
                            const quantity = p.quantity ?? 1;
                            return sum + (unitPrice * quantity);
                          }, 0);
                          const totalInvoiceValue = nfeData.totals?.totalInvoice ?? 0;
                          const totalTaxes = totalInvoiceValue - totalProductsValue;
                          
                          // Calcular proporção de impostos para este produto
                          const productUnitPrice = product.unitPrice ?? 0;
                          const productQuantity = product.quantity ?? 1;
                          const productValue = productUnitPrice * productQuantity;
                          
                          const taxProportion = totalProductsValue > 0 ? (productValue / totalProductsValue) : 0;
                          const productTax = totalTaxes * taxProportion;
                          
                          // Valor unitário final = valor unitário + (imposto / quantity)
                          const realUnitPrice = productUnitPrice + (productTax / productQuantity);
                          
                          return realUnitPrice.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
                            style: "currency",
                            currency: locale === "en-US" ? "USD" : "BRL",
                          });
                        })()}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={productData.serialNumber}
                          onChange={(e) => handleProductDataChange(order, "serialNumber", e.target.value)}
                          placeholder={requirements.requiresSerial ? "Obrigatório" : "Opcional"}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={productData.serviceTag}
                          onChange={(e) => handleProductDataChange(order, "serviceTag", e.target.value)}
                          placeholder="Opcional"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={productData.assetNumber}
                          onChange={(e) => handleProductDataChange(order, "assetNumber", e.target.value)}
                          placeholder={requirements.requiresAssetTag ? "Obrigatório" : "Opcional"}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={productData.productTypeId || sharedData.productTypeId}
                          onValueChange={(value) => handleProductDataChange(order, "productTypeId", value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Usar compartilhado" />
                          </SelectTrigger>
                          <SelectContent>
                            {productTypes.map((type) => (
                              <SelectItem key={type.id} value={String(type.id)}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={productData.departmentId || sharedData.departmentId}
                          onValueChange={(value) => handleProductDataChange(order, "departmentId", value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Usar compartilhado" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={String(dept.id)}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={productData.locationId || sharedData.locationId}
                          onValueChange={(value) => handleProductDataChange(order, "locationId", value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Usar compartilhado" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map((location) => (
                              <SelectItem key={location.id} value={String(location.id)}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {batchImportMutation.data?.results.errors && batchImportMutation.data.results.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {batchImportMutation.data.results.errors.length} produto(s) falharam na importação.
                Verifique os erros e tente novamente.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={validateAndSubmit}
            disabled={batchImportMutation.isPending}
          >
            {batchImportMutation.isPending ? "Importando..." : `Importar ${totalProducts} Produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

