import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import {
  useInventoryDashboardAlerts,
  useInventoryDashboardMovements,
  useInventoryDashboardStats,
  useInventoryDashboardTopProducts,
} from "@/hooks/useInventoryApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Package2, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function InventoryOverviewPage() {
  const { formatMessage, locale } = useI18n();
  const statsQuery = useInventoryDashboardStats();
  const alertsQuery = useInventoryDashboardAlerts();
  const movementsQuery = useInventoryDashboardMovements();
  const topProductsQuery = useInventoryDashboardTopProducts();

  const stats = statsQuery.data?.data;
  const alerts = alertsQuery.data?.data ?? [];
  const movements = movementsQuery.data?.data ?? [];
  const topProducts = topProductsQuery.data?.data ?? [];

  const statusCards = stats?.statuses ?? [];
  const isLoadingCards = statsQuery.isLoading;
  const getStatusLabel = (status: string) => {
    const key = `inventory.status.${status}`;
    const translated = formatMessage(key as any);
    return translated === key ? status : translated;
  };

  return (
    <InventoryLayout
      title={formatMessage("inventory.overview_title")}
      description={formatMessage("inventory.overview_description")}
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/inventory/movements">{formatMessage("inventory.overview.actions.view_movements")}</Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/catalog">{formatMessage("inventory.overview.actions.view_catalog")}</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {formatMessage("inventory.overview.cards.total_label")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            {isLoadingCards ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <p className="text-3xl font-semibold">{stats?.total ?? 0}</p>
            )}
            <Package2 className="h-8 w-8 text-muted-foreground" />
          </CardContent>
        </Card>
        {isLoadingCards
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={`status-skeleton-${index}`}>
                <CardContent className="py-6">
                  <Skeleton className="h-6 w-24" />
                </CardContent>
              </Card>
            ))
          : statusCards.map((item) => (
              <Card key={item.status}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    {getStatusLabel(item.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold">{item.count}</p>
                </CardContent>
              </Card>
            ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{formatMessage("inventory.overview.alerts.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">{formatMessage("inventory.overview.alerts.subtitle")}</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-4">
            {alertsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : alerts.length === 0 ? (
              <InventoryEmptyState
                title={formatMessage("inventory.overview.alerts.empty")}
                description={formatMessage("inventory.overview.alerts.empty_description")}
              />
            ) : (
              alerts.slice(0, 5).map((alert: any) => (
                <div key={alert.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{alert.alert_type}</p>
                    <span className="text-sm text-muted-foreground capitalize">{alert.severity}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{formatMessage("inventory.overview.top.title")}</CardTitle>
              <p className="text-sm text-muted-foreground">{formatMessage("inventory.overview.top.subtitle")}</p>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {topProductsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : topProducts.length === 0 ? (
              <InventoryEmptyState
                title={formatMessage("inventory.overview.top.empty")}
                description={formatMessage("inventory.overview.top.empty_description")}
              />
            ) : (
              <div className="space-y-3">
                {topProducts.slice(0, 5).map((product: any) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">#{product.productId}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.name ?? formatMessage("inventory.overview.top.unknown")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{product.uses}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMessage("inventory.overview.top.uses")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{formatMessage("inventory.overview.movements.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatMessage("inventory.overview.movements.subtitle")}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/inventory/movements" className="flex items-center">
              {formatMessage("inventory.overview.movements.view_all")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {movementsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <InventoryEmptyState
              title={formatMessage("inventory.overview.movements.empty")}
              description={formatMessage("inventory.overview.movements.empty_description")}
            />
          ) : (
            <div className="space-y-3">
              {movements.slice(0, 6).map((movement: any) => (
                <div
                  key={movement.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {formatMessage("inventory.overview.movements.product", { id: movement.product_id })}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{movement.movement_type}</p>
                  </div>
                  <InventoryStatusBadge status={movement.approval_status} />
                  <p className="text-xs text-muted-foreground">
                    {movement.movement_date
                      ? format(new Date(movement.movement_date), locale === "en-US" ? "MM/dd/yyyy HH:mm" : "dd/MM/yyyy HH:mm")
                      : "--"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </InventoryLayout>
  );
}

