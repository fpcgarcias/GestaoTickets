import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

type StatusKey =
  | "available"
  | "in_use"
  | "maintenance"
  | "reserved"
  | "written_off"
  | "pending"
  | "approved"
  | "rejected"
  | "draft";

const statusStyles: Record<
  StatusKey,
  { messageKey: string; className: string; variant?: "default" | "secondary" | "destructive" | "outline" }
> = {
  available: { messageKey: "inventory.status.available", className: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  in_use: { messageKey: "inventory.status.in_use", className: "bg-blue-100 text-blue-900 border-blue-200" },
  maintenance: { messageKey: "inventory.status.maintenance", className: "bg-amber-100 text-amber-900 border-amber-200" },
  reserved: { messageKey: "inventory.status.reserved", className: "bg-purple-100 text-purple-900 border-purple-200" },
  written_off: { messageKey: "inventory.status.written_off", className: "bg-slate-100 text-slate-900 border-slate-200" },
  pending: { messageKey: "inventory.status.pending", className: "bg-amber-100 text-amber-900 border-amber-200" },
  approved: { messageKey: "inventory.status.approved", className: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  rejected: { messageKey: "inventory.status.rejected", className: "bg-rose-100 text-rose-900 border-rose-200" },
  draft: { messageKey: "inventory.status.draft", className: "bg-gray-100 text-gray-900 border-gray-200" },
};

interface InventoryStatusBadgeProps {
  status?: string | null;
  fallbackLabel?: string;
}

export function InventoryStatusBadge({ status, fallbackLabel = "Desconhecido" }: InventoryStatusBadgeProps) {
  const { formatMessage } = useI18n();
  const normalized = (status ?? "").toLowerCase().replace(/\s+/g, "_") as StatusKey;
  const style = statusStyles[normalized];
  const label = style ? formatMessage(style.messageKey as any) : fallbackLabel;

  return (
    <Badge
      variant={style?.variant ?? "outline"}
      className={cn(
        "capitalize bg-transparent border",
        style?.className,
        !style && "border-muted text-muted-foreground"
      )}
    >
      {label}
    </Badge>
  );
}

