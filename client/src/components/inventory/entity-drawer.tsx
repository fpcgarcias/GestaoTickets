import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

type DrawerSize = "sm" | "md" | "lg";

const sizeClasses: Record<DrawerSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
};

interface DrawerAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "destructive";
}

interface EntityDrawerProps {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  primaryAction?: DrawerAction;
  secondaryAction?: DrawerAction;
  size?: DrawerSize;
  className?: string;
}

export function EntityDrawer({
  title,
  description,
  open,
  onOpenChange,
  children,
  primaryAction,
  secondaryAction,
  size = "lg",
  className,
}: EntityDrawerProps) {
  const { formatMessage } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("flex flex-col gap-0 p-0", sizeClasses[size], className)}>
        <SheetHeader className="border-b border-border/60 px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-6">{children}</ScrollArea>
        <div className="flex flex-col gap-2 border-t border-border/60 bg-background/80 px-6 py-4 sm:flex-row sm:justify-end">
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant ?? "outline"}
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              variant={primaryAction.variant ?? "default"}
              disabled={primaryAction.disabled || primaryAction.loading}
              onClick={primaryAction.onClick}
            >
              {primaryAction.loading ? formatMessage("inventory.drawer.saving") : primaryAction.label}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

