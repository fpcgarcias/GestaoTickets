import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";

const InventoryOverviewPage = lazy(() => import("./overview"));
const InventoryCatalogPage = lazy(() => import("./catalog"));
const InventoryMovementsPage = lazy(() => import("./movements"));
const InventoryAssignmentsPage = lazy(() => import("./assignments"));
const InventorySuppliersPage = lazy(() => import("./suppliers"));
const InventoryProductTypesPage = lazy(() => import("./product-types"));
const InventoryLocationsPage = lazy(() => import("./locations"));
const InventoryReportsPage = lazy(() => import("./reports"));
const InventoryWebhooksPage = lazy(() => import("./webhooks"));

function InventoryFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando Inventário…</span>
      </div>
    </div>
  );
}

const inventoryRoutes = [
  { path: "/inventory", component: InventoryOverviewPage },
  { path: "/inventory/catalog", component: InventoryCatalogPage },
  { path: "/inventory/movements", component: InventoryMovementsPage },
  { path: "/inventory/assignments", component: InventoryAssignmentsPage },
  { path: "/inventory/suppliers", component: InventorySuppliersPage },
  { path: "/inventory/product-types", component: InventoryProductTypesPage },
  { path: "/inventory/locations", component: InventoryLocationsPage },
  { path: "/inventory/reports", component: InventoryReportsPage },
  { path: "/inventory/webhooks", component: InventoryWebhooksPage },
];

export default function InventoryRouter() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <Switch>
        {inventoryRoutes.map((route) => (
          <Route key={route.path} path={route.path} component={route.component} />
        ))}
        <Route component={InventoryOverviewPage} />
      </Switch>
    </Suspense>
  );
}

