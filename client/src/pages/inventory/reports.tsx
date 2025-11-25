import { useMemo } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";

const REPORTS = [
  { type: "inventory_full", title: "inventory.reports.list.inventory_full" },
  { type: "products_by_user", title: "inventory.reports.list.products_by_user" },
  { type: "products_by_department", title: "inventory.reports.list.products_by_department" },
  { type: "movements_history", title: "inventory.reports.list.movements_history" },
  { type: "maintenance", title: "inventory.reports.list.maintenance" },
  { type: "write_off", title: "inventory.reports.list.write_off" },
  { type: "cost_by_department", title: "inventory.reports.list.cost_by_department" },
  { type: "depreciation", title: "inventory.reports.list.depreciation" },
  { type: "tco", title: "inventory.reports.list.tco" },
  { type: "supplier_analysis", title: "inventory.reports.list.supplier_analysis" },
  { type: "compliance_docs", title: "inventory.reports.list.compliance" },
  { type: "licenses_expiring", title: "inventory.reports.list.licenses" },
  { type: "terms_pending", title: "inventory.reports.list.terms" },
  { type: "audit_movements", title: "inventory.reports.list.audit" },
];

export default function InventoryReportsPage() {
  const { formatMessage, locale } = useI18n();

  const reportCards = useMemo(
    () =>
      REPORTS.map((report) => ({
        ...report,
      })),
    []
  );

  const handleGenerate = async (type: string) => {
    const params = new URLSearchParams({ type, format: "xlsx", locale });
    const url = `${config.apiBaseUrl}/api/inventory/reports?${params.toString()}`;
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${type}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      // Em caso de erro, apenas registra no console para não quebrar a UI
      console.error("Erro ao gerar relatório de inventário:", error?.message || error);
    }
  };

  return (
    <InventoryLayout
      title={formatMessage("inventory.reports_title")}
      description={formatMessage("inventory.reports_description")}
      breadcrumb={[{ label: formatMessage("inventory.reports_breadcrumb") }]}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((report) => (
          <Card key={report.type}>
            <CardHeader>
              <CardTitle>{formatMessage(`${report.title}.title` as any)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {formatMessage(`${report.title}.description` as any)}
              </p>
              <Button onClick={() => handleGenerate(report.type)}>
                {formatMessage("inventory.reports.actions.generate")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </InventoryLayout>
  );
}

