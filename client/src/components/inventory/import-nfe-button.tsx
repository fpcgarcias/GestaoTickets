import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { InventoryNfeParseResult, useImportInventoryNfe } from "@/hooks/useInventoryApi";

interface ImportNfeButtonProps {
  onParsed?: (data: InventoryNfeParseResult) => void;
  label?: string;
  helperText?: string;
  className?: string;
}

export function ImportNfeButton({ onParsed, label, helperText, className }: ImportNfeButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const importMutation = useImportInventoryNfe();
  const { formatMessage, locale } = useI18n();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importMutation.mutate(file, {
      onSuccess: (parsed) => {
        onParsed?.(parsed);
        event.target.value = "";
      },
      onSettled: () => {
        event.target.value = "";
      },
    });
  };

  const supplierName =
    importMutation.data?.supplier?.name ?? formatMessage("inventory.nfe.unknown_supplier");
  const totalInvoice = importMutation.data?.totals?.totalInvoice;
  const formattedTotal =
    typeof totalInvoice === "number"
      ? totalInvoice.toLocaleString(locale === "en-US" ? "en-US" : "pt-BR", {
          style: "currency",
          currency: locale === "en-US" ? "USD" : "BRL",
        })
      : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={importMutation.isPending}
      >
        <UploadCloud className="mr-2 h-4 w-4" />
        {importMutation.isPending
          ? formatMessage("inventory.nfe.importing")
          : label ?? formatMessage("inventory.nfe.import")}
      </Button>
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      {importMutation.data && (
        <p className="text-xs text-muted-foreground">
          {formatMessage("inventory.nfe.summary", {
            supplier: supplierName,
            total: formattedTotal ?? "--",
          })}
        </p>
      )}
    </div>
  );
}

