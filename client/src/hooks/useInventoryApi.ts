import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { config } from "@/lib/config";
import { DateRange } from "react-day-picker";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface InventoryPaginatedResponse<T> {
  success?: boolean;
  data: T;
  pagination?: {
    total: number;
    page?: number;
    limit?: number;
  };
}

export interface InventoryDashboardStats {
  total: number;
  statuses: { status: string; count: number }[];
}

export interface InventoryProduct {
  id: number;
  name: string;
  status: string;
  product_type_id?: number;
  supplier_id?: number;
  department_id?: number;
  location_id?: number;
  asset_number?: string;
  serial_number?: string;
  service_tag?: string;
   purchase_value?: string;
  invoice_number?: string;
  purchase_date?: string;
  invoice_date?: string;
  warranty_expiry?: string;
  created_at?: string;
}

export interface InventoryProductType {
  id: number;
  name: string;
  category_id?: number;
  code?: string;
  department_id?: number;
}

export interface InventoryProductCategory {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  department_id?: number;
  is_consumable?: boolean;
  requires_serial?: boolean;
  requires_asset_tag?: boolean;
  min_stock_alert?: number;
  custom_fields?: string;
  company_id?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InventorySupplier {
  id: number;
  name: string;
  cnpj?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

export interface InventoryLocation {
  id: number;
  name: string;
  type?: string;
  parent_location_id?: number;
  department_id?: number;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  product_name?: string | null;
  movement_type: string;
  quantity: number;
  approval_status: string;
  movement_date?: string;
  ticket_id?: number;
  ticket_code?: string | null;
  responsible_id?: number;
  responsible_name?: string | null;
}

export interface InventoryAssignment {
  id: number;
  product_id: number;
  user_id?: number;
  user_name?: string | null;
  status?: string;
  expected_return_date?: string;
  actual_return_date?: string;
  product?: {
    id: number;
    name: string;
  } | null;
  responsibility_term_id?: number | null;
  term_status?: 'generated' | 'sent' | 'signed' | null;
  signature_status?: string | null;
  _debug?: any;
}

export interface InventoryWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  status?: string;
  last_triggered_at?: string;
}

export interface InventoryNfeParseResult {
  invoiceKey?: string;
  invoiceNumber?: string;
  series?: string;
  issueDate?: string;
  entryDate?: string;
  operationNature?: string;
  model?: string;
  supplier?: {
    name?: string;
    tradeName?: string;
    cnpj?: string;
    stateRegistration?: string;
    municipalRegistration?: string;
    state?: string;
    phone?: string;
    email?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      cityCode?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  buyer?: {
    name?: string;
    cnpj?: string;
    cpf?: string;
    stateRegistration?: string;
    state?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      cityCode?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  products?: Array<{
    order: number;
    code?: string;
    description?: string;
    ncm?: string;
    cfop?: string;
    cest?: string;
    unit?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    barCode?: string;
    additionalInfo?: string;
    productCode?: string;
  }>;
  totals?: {
    totalProducts?: number;
    totalInvoice?: number;
    totalDiscounts?: number;
    totalFreight?: number;
    totalInsurance?: number;
    totalII?: number;
    totalIPI?: number;
    totalICMS?: number;
    totalPis?: number;
    totalCofins?: number;
  };
  additionalInfo?: string;
  supplierId?: number;
  serviceTags?: string[]; // Service tags extraídas (especialmente para Dell)
}

export interface InventoryProductsFilters {
  search?: string;
  status?: string | string[];
  department_id?: number;
  location_id?: number;
  product_type_id?: number;
  supplier_id?: number;
  page?: number;
  limit?: number;
  date_range?: DateRange;
}

const buildQueryString = (params?: Record<string, any>) => {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null && `${entry}`.length > 0) {
          searchParams.append(key, String(entry));
        }
      });
      return;
    }
    if (typeof value === "object" && "from" in value) {
      const range = value as DateRange;
      if (range.from) {
        searchParams.append(`${key}_from`, range.from.toISOString());
      }
      if (range.to) {
        searchParams.append(`${key}_to`, range.to.toISOString());
      }
      return;
    }
    searchParams.append(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const fetchJson = async <T>(path: string, params?: Record<string, any>): Promise<T> => {
  const query = buildQueryString(params);
  const res = await apiRequest("GET", `${path}${query}`);
  return res.json();
};

const mutateJson = async <T>(method: HttpMethod, path: string, body?: Record<string, any>): Promise<T> => {
  const res = await apiRequest(method, path, body);
  return res.json();
};

export const inventoryKeys = {
  dashboard: {
    stats: ["inventory", "dashboard", "stats"] as const,
    alerts: ["inventory", "dashboard", "alerts"] as const,
    movements: ["inventory", "dashboard", "movements"] as const,
    top: ["inventory", "dashboard", "top"] as const,
  },
  products: {
    root: ["inventory", "products"] as const,
    list: (filters: Record<string, any>) => ["inventory", "products", filters] as const,
    detail: (id: number | string) => ["inventory", "products", id] as const,
  },
  productTypes: {
    root: ["inventory", "product-types"] as const,
    list: (filters?: Record<string, any>) => ["inventory", "product-types", filters ?? {}] as const,
  },
  suppliers: {
    root: ["inventory", "suppliers"] as const,
    list: (filters?: Record<string, any>) => ["inventory", "suppliers", filters ?? {}] as const,
  },
  locations: {
    list: ["inventory", "locations"] as const,
  },
  movements: {
    root: ["inventory", "movements"] as const,
    list: (filters: Record<string, any>) => ["inventory", "movements", filters] as const,
  },
  assignments: {
    root: ["inventory", "assignments"] as const,
    list: (filters: Record<string, any>) => ["inventory", "assignments", filters] as const,
  },
  webhooks: {
    root: ["inventory", "webhooks"] as const,
    list: ["inventory", "webhooks"] as const,
  },
};

export function useInventoryDashboardStats() {
  const { user } = useAuth();
  const canAccessInventory = !!user && user.role !== 'customer';
  
  return useQuery({
    queryKey: inventoryKeys.dashboard.stats,
    queryFn: () => fetchJson<{ success: true; total: number; statuses: { status: string; count: number }[] }>("/api/inventory/dashboard/stats"),
    enabled: canAccessInventory,
  });
}

export function useInventoryDashboardAlerts() {
  const { user } = useAuth();
  const canAccessInventory = !!user && user.role !== 'customer';
  
  return useQuery({
    queryKey: inventoryKeys.dashboard.alerts,
    queryFn: () => fetchJson<InventoryPaginatedResponse<any[]>>("/api/inventory/dashboard/alerts"),
    enabled: canAccessInventory,
  });
}

export function useInventoryDashboardMovements() {
  const { user } = useAuth();
  const canAccessInventory = !!user && user.role !== 'customer';
  
  return useQuery({
    queryKey: inventoryKeys.dashboard.movements,
    queryFn: () => fetchJson<{ success: true; data: InventoryMovement[] }>("/api/inventory/dashboard/movements"),
    enabled: canAccessInventory,
  });
}

export function useInventoryDashboardTopProducts() {
  return useQuery({
    queryKey: inventoryKeys.dashboard.top,
    queryFn: () => fetchJson<InventoryPaginatedResponse<any[]>>("/api/inventory/dashboard/top-products"),
  });
}

export function useInventoryProducts(filters: InventoryProductsFilters) {
  const { user } = useAuth();
  const canAccessInventory = !!user && user.role !== 'customer';
  
  return useQuery({
    queryKey: inventoryKeys.products.list(filters),
    queryFn: () => fetchJson<InventoryPaginatedResponse<InventoryProduct[]>>("/api/inventory/products", filters),
    enabled: canAccessInventory,
    keepPreviousData: true,
  });
}

export function useInventoryProductTypes(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: inventoryKeys.productTypes.list({ includeInactive: Boolean(options?.includeInactive) }),
    queryFn: () =>
      fetchJson<InventoryPaginatedResponse<InventoryProductType[]>>("/api/inventory/product-types", {
        include_inactive: options?.includeInactive ? "true" : undefined,
      }),
  });
}

export function useInventoryProductCategories(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["inventory", "product-categories", { includeInactive: Boolean(options?.includeInactive) }],
    queryFn: () =>
      fetchJson<InventoryPaginatedResponse<InventoryProductCategory[]>>("/api/inventory/product-categories", {
        include_inactive: options?.includeInactive ? "true" : undefined,
      }),
  });
}

export function useInventorySuppliers(options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: inventoryKeys.suppliers.list({ includeInactive: Boolean(options?.includeInactive) }),
    queryFn: () =>
      fetchJson<InventoryPaginatedResponse<InventorySupplier[]>>("/api/inventory/suppliers", {
        include_inactive: options?.includeInactive ? "true" : undefined,
      }),
  });
}

export function useInventoryLocations() {
  const { user } = useAuth();
  const canAccessInventory = !!user && user.role !== 'customer';
  
  return useQuery({
    queryKey: inventoryKeys.locations.list,
    queryFn: () => fetchJson<InventoryPaginatedResponse<InventoryLocation[]>>("/api/inventory/locations"),
    enabled: canAccessInventory,
  });
}

export function useInventoryMovements(filters: Record<string, any>) {
  return useQuery({
    queryKey: inventoryKeys.movements.list(filters),
    queryFn: () => fetchJson<InventoryPaginatedResponse<InventoryMovement[]>>("/api/inventory/movements", filters),
    keepPreviousData: true,
  });
}

export function useInventoryAssignments(filters: Record<string, any>) {
  return useQuery({
    queryKey: inventoryKeys.assignments.list(filters),
    queryFn: () => fetchJson<InventoryPaginatedResponse<InventoryAssignment[]>>("/api/inventory/assignments", filters),
    keepPreviousData: true,
  });
}

export function useInventoryWebhooks() {
  return useQuery({
    queryKey: inventoryKeys.webhooks.list,
    queryFn: () => fetchJson<InventoryPaginatedResponse<InventoryWebhook[]>>("/api/inventory/webhooks"),
  });
}

const useInventoryMutation = <TVariables = any, TData = any>({
  method,
  path,
  successMessage,
  errorMessage,
  invalidateKeys = [] as ReadonlyArray<readonly unknown[]>,
  getBody,
}: {
  method: HttpMethod;
  path: string | ((variables: TVariables) => string);
  successMessage?: string;
  errorMessage?: string;
  invalidateKeys?: ReadonlyArray<readonly unknown[]>;
  getBody?: (variables: TVariables) => Record<string, any> | undefined;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation<TData, any, TVariables>({
    mutationFn: (variables) => {
      const targetPath = typeof path === "function" ? path(variables) : path;
      const payload =
        method === "GET" ? undefined : getBody ? getBody(variables) : (variables as Record<string, any>);
      return mutateJson<TData>(method, targetPath, payload);
    },
    onSuccess: (data) => {
      if (successMessage) toast({ title: successMessage });
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (error: any) => {
      toast({
        title: errorMessage ?? "Erro ao processar solicitação",
        description: error?.message,
        variant: "destructive",
      });
    },
  });
};

export const useCreateInventoryProduct = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/products",
    successMessage: "Produto criado com sucesso",
    errorMessage: "Erro ao criar produto",
    invalidateKeys: [inventoryKeys.products.root],
  });

export const useUpdateInventoryProduct = () =>
  useInventoryMutation<{ id: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/inventory/products/${vars.id}`,
    successMessage: "Produto atualizado",
    errorMessage: "Erro ao atualizar produto",
    invalidateKeys: [inventoryKeys.products.root],
    getBody: (vars) => vars.payload,
  });

export const useDeleteInventoryProduct = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/products/${vars.id}`,
    successMessage: "Produto removido",
    errorMessage: "Erro ao remover produto",
    invalidateKeys: [inventoryKeys.products.root],
    getBody: () => undefined,
  });

export const useCreateInventoryProductType = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/product-types",
    successMessage: "Tipo de produto criado",
    errorMessage: "Erro ao criar tipo",
    invalidateKeys: [inventoryKeys.productTypes.root],
  });

export const useUpdateInventoryProductType = () =>
  useInventoryMutation<{ id: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/inventory/product-types/${vars.id}`,
    successMessage: "Tipo de produto atualizado",
    errorMessage: "Erro ao atualizar tipo",
    invalidateKeys: [inventoryKeys.productTypes.root],
    getBody: (vars) => vars.payload,
  });

export const useDeleteInventoryProductType = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/product-types/${vars.id}`,
    successMessage: "Tipo de produto removido",
    errorMessage: "Erro ao remover tipo",
    invalidateKeys: [inventoryKeys.productTypes.root],
    getBody: () => undefined,
  });

export const useCreateInventoryProductCategory = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/product-categories",
    successMessage: "Categoria criada com sucesso",
    errorMessage: "Erro ao criar categoria",
    invalidateKeys: [["inventory", "product-categories"]],
  });

export const useUpdateInventoryProductCategory = () =>
  useInventoryMutation<{ id: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/inventory/product-categories/${vars.id}`,
    successMessage: "Categoria atualizada com sucesso",
    errorMessage: "Erro ao atualizar categoria",
    invalidateKeys: [["inventory", "product-categories"]],
    getBody: (vars) => vars.payload,
  });

export const useDeleteInventoryProductCategory = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/product-categories/${vars.id}`,
    successMessage: "Categoria inativada com sucesso",
    errorMessage: "Erro ao inativar categoria",
    invalidateKeys: [["inventory", "product-categories"]],
    getBody: () => undefined,
  });

export const useCreateInventorySupplier = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/suppliers",
    successMessage: "Fornecedor criado",
    errorMessage: "Erro ao criar fornecedor",
    invalidateKeys: [inventoryKeys.suppliers.root],
  });

export const useUpdateInventorySupplier = () =>
  useInventoryMutation<{ id: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/inventory/suppliers/${vars.id}`,
    successMessage: "Fornecedor atualizado",
    errorMessage: "Erro ao atualizar fornecedor",
    invalidateKeys: [inventoryKeys.suppliers.root],
    getBody: (vars) => vars.payload,
  });

export const useDeleteInventorySupplier = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/suppliers/${vars.id}`,
    successMessage: "Fornecedor desativado",
    errorMessage: "Erro ao desativar fornecedor",
    invalidateKeys: [inventoryKeys.suppliers.root],
    getBody: () => undefined,
  });

export const useCreateInventoryLocation = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/locations",
    successMessage: "Localização criada",
    errorMessage: "Erro ao criar localização",
    invalidateKeys: [inventoryKeys.locations.list],
  });

export const useUpdateInventoryLocation = () =>
  useInventoryMutation<{ id: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/inventory/locations/${vars.id}`,
    successMessage: "Localização atualizada",
    errorMessage: "Erro ao atualizar localização",
    invalidateKeys: [inventoryKeys.locations.list],
    getBody: (vars) => vars.payload,
  });

export const useDeleteInventoryLocation = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/locations/${vars.id}`,
    successMessage: "Localização removida",
    errorMessage: "Erro ao remover localização",
    invalidateKeys: [inventoryKeys.locations.list],
    getBody: () => undefined,
  });

export const useCreateInventoryMovement = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/movements",
    successMessage: "Movimentação registrada",
    errorMessage: "Erro ao registrar movimentação",
    invalidateKeys: [inventoryKeys.movements.root, inventoryKeys.dashboard.movements],
  });

export const useApproveInventoryMovement = () =>
  useInventoryMutation<{ id: number }>({
    method: "POST",
    path: (vars) => `/api/inventory/movements/${vars.id}/approve`,
    successMessage: "Movimentação aprovada",
    errorMessage: "Erro ao aprovar movimentação",
    invalidateKeys: [inventoryKeys.movements.root],
    getBody: () => undefined,
  });

export const useRejectInventoryMovement = () =>
  useInventoryMutation<{ id: number }>({
    method: "POST",
    path: (vars) => `/api/inventory/movements/${vars.id}/reject`,
    successMessage: "Movimentação rejeitada",
    errorMessage: "Erro ao rejeitar movimentação",
    invalidateKeys: [inventoryKeys.movements.root],
    getBody: () => undefined,
  });

export const useDeleteInventoryMovement = () =>
  useInventoryMutation<{ id: number }>({
    method: "DELETE",
    path: (vars) => `/api/inventory/movements/${vars.id}`,
    successMessage: "Movimentação excluída",
    errorMessage: "Erro ao excluir movimentação",
    invalidateKeys: [inventoryKeys.movements.root, inventoryKeys.dashboard.movements],
    getBody: () => undefined,
  });

export const useCreateInventoryWebhook = () =>
  useInventoryMutation({
    method: "POST",
    path: "/api/inventory/webhooks",
    successMessage: "Webhook criado",
    errorMessage: "Erro ao criar webhook",
    invalidateKeys: [inventoryKeys.webhooks.root],
  });

export const useDeleteInventoryWebhook = () =>
  useInventoryMutation({
    method: "DELETE",
    path: (vars: { id: number }) => `/api/inventory/webhooks/${vars.id}`,
    successMessage: "Webhook removido",
    errorMessage: "Erro ao remover webhook",
    invalidateKeys: [inventoryKeys.webhooks.root],
    getBody: () => undefined,
  });

export const useReturnInventoryAssignment = () =>
  useInventoryMutation<{ assignmentId: number }>({
    method: "POST",
    path: (vars) => `/api/inventory/assignments/${vars.assignmentId}/return`,
    successMessage: "Devolução registrada",
    errorMessage: "Erro ao registrar devolução",
    invalidateKeys: [inventoryKeys.assignments.root],
    getBody: () => undefined,
  });

export const useCreateInventoryTerm = () =>
  useInventoryMutation<{ 
    assignmentId?: number; 
    assignmentGroupId?: string;
    assignmentIds?: number[];
    payload?: Record<string, any> 
  }>({
    method: "POST",
    path: (vars) => {
      if (vars.assignmentId) {
        return `/api/inventory/assignments/${vars.assignmentId}/terms`;
      }
      // Para termos em lote, usar endpoint de termos diretamente
      return `/api/inventory/terms/batch`;
    },
    errorMessage: "Erro ao gerar termo",
    invalidateKeys: [inventoryKeys.assignments.root],
    getBody: (vars) => {
      if (vars.assignmentId) {
        return vars.payload;
      }
      // Para termos em lote
      return {
        assignment_group_id: vars.assignmentGroupId,
        assignment_ids: vars.assignmentIds,
        ...vars.payload,
      };
    },
  });

export const useSendInventoryTerm = () =>
  useInventoryMutation<{ termId: number; payload?: Record<string, any> }>({
    method: "POST",
    path: (vars) => `/api/inventory/terms/${vars.termId}/send`,
    successMessage: "Termo enviado",
    errorMessage: "Erro ao enviar termo",
    getBody: (vars) => vars.payload,
  });

export const useRequestDigitalSignature = () =>
  useInventoryMutation<{ termId: number; provider?: string }>({
    method: "POST",
    path: (vars) => `/api/inventory/terms/${vars.termId}/request-signature`,
    successMessage: "Termo enviado para ClickSign com sucesso",
    errorMessage: "Erro ao enviar termo para assinatura",
    invalidateKeys: [inventoryKeys.assignments.root],
    getBody: (vars) => ({ provider: vars.provider || 'clicksign' }),
  });

export const useUpdateInventoryDepartmentSettings = () =>
  useInventoryMutation<{ departmentId: number; payload: Record<string, any> }>({
    method: "PUT",
    path: (vars) => `/api/departments/${vars.departmentId}/inventory-settings`,
    successMessage: "Configurações atualizadas",
    errorMessage: "Erro ao salvar configurações",
    getBody: (vars) => vars.payload,
  });

export function useImportInventoryNfe() {
  const { toast } = useToast();
  return useMutation<InventoryNfeParseResult, any, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${config.apiBaseUrl}/api/inventory/products/import-nfe`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Erro ao importar NF-e");
      }
      const payload = await response.json();
      return payload.data as InventoryNfeParseResult;
    },
    onSuccess: () => {
      toast({ title: "NF-e importada", description: "Dados preenchidos automaticamente." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar NF-e",
        description: error?.message ?? "Falha ao processar arquivo.",
        variant: "destructive",
      });
    },
  });
}

export interface BatchImportProduct {
  name: string;
  product_type_id: number;
  supplier_id: number;
  serial_number?: string;
  service_tag?: string;
  asset_number?: string;
  purchase_value?: string;
  department_id?: number;
  location_id?: number;
  invoice_number?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  notes?: string;
}

export interface BatchImportRequest {
  products: BatchImportProduct[];
}

export interface BatchImportResult {
  success: Array<{ index: number; id: number; name: string }>;
  errors: Array<{ index: number; product: BatchImportProduct; error: string }>;
}

export function useImportInventoryProductsBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation<{ success: boolean; message: string; results: BatchImportResult }, any, BatchImportRequest>({
    mutationFn: async (request: BatchImportRequest) => {
      const response = await apiRequest("POST", "/api/inventory/products/import-batch", request);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Erro ao importar produtos em lote");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.products.root });
      toast({
        title: "Importação concluída",
        description: data.message,
        variant: data.results.errors.length > 0 ? "default" : "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar produtos",
        description: error?.message ?? "Falha ao importar produtos em lote.",
        variant: "destructive",
      });
    },
  });
}

