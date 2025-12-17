import { ReactNode, useMemo } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { Link } from "wouter";

type BreadcrumbEntry = {
  label: string;
  href?: string;
};

interface InventoryLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  breadcrumb?: BreadcrumbEntry[];
  className?: string;
}

export function InventoryLayout({
  title,
  description,
  actions,
  children,
  breadcrumb,
  className,
}: InventoryLayoutProps) {
  const { formatMessage } = useI18n();

  const computedBreadcrumb = useMemo<BreadcrumbEntry[]>(() => {
    const root: BreadcrumbEntry = {
      label: formatMessage("sidebar.inventory"),
      href: "/inventory",
    };
    if (!breadcrumb || breadcrumb.length === 0) {
      return [root];
    }
    return [root, ...breadcrumb];
  }, [breadcrumb, formatMessage]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            {computedBreadcrumb.map((item, index) => (
              <span className="flex items-center" key={`${item.label}-${index}`}>
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground">{item.label}</span>
                  )}
                </BreadcrumbItem>
                {index < computedBreadcrumb.length - 1 && <BreadcrumbSeparator />}
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-muted-foreground mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        <Separator />
      </div>
      {children}
    </div>
  );
}

InventoryLayout.displayName = "InventoryLayout";

