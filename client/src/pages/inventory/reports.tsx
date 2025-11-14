import { useMemo, useState } from "react";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { config } from "@/lib/config";

type ReportFormat = "json" | "xlsx";

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
  const { formatMessage } = useI18n();
  const { toast } = useToast();
  const [formats, setFormats] = useState<Record<string, ReportFormat>>({});

  const reportCards = useMemo(
    () =>
      REPORTS.map((report) => ({
        ...report,
        format: formats[report.type] ?? "json",
      })),
    [formats]
  );

  const handleChangeFormat = (type: string, format: ReportFormat) => {
    setFormats((prev) => ({ ...prev, [type]: format }));
  };

  const handleGenerate = async (type: string, format: ReportFormat) => {
    const params = new URLSearchParams({ type, format });
    const url = `${config.apiBaseUrl}/api/inventory/reports?${params.toString()}`;
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      if (format === "xlsx") {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${type}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
      } else {
        const data = await response.json();
        toast({
          title: formatMessage("inventory.reports.toast.generated_json"),
          description: JSON.stringify(data).slice(0, 120) + "...",
        });
      }
    } catch (error: any) {
      toast({
        title: formatMessage("inventory.reports.toast.error"),
        description: error?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <InventoryLayout
      title={formatMessage("inventory.reports_title")}
      description={formatMessage("inventory.reports_description")}
      breadcrumb={[{ label: formatMessage("inventory.reports_breadcrumb") }]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {reportCards.map((report) => (
          <Card key={report.type}>
            <CardHeader>
              <CardTitle>{formatMessage(`${report.title}.title` as any)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {formatMessage(`${report.title}.description` as any)}
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={report.format}
                  onValueChange={(value: ReportFormat) => handleChangeFormat(report.type, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => handleGenerate(report.type, report.format)}>
                  {formatMessage("inventory.reports.actions.generate")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </InventoryLayout>
  );
}

