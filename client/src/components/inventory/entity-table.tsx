import { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InventoryEmptyState } from "./inventory-empty-state";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

export interface EntityColumn<T> {
  key: string;
  header: ReactNode;
  className?: string;
  cellClassName?: string;
  render: (item: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
}

export interface EntityTablePagination {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

interface EntityTableProps<T> {
  data: T[];
  columns: EntityColumn<T>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  pagination?: EntityTablePagination;
  rowKey?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  maxHeight?: number;
  className?: string;
}

export function EntityTable<T>({
  data,
  columns,
  isLoading,
  emptyTitle,
  emptyDescription,
  emptyAction,
  pagination,
  rowKey,
  onRowClick,
  maxHeight,
  className,
}: EntityTableProps<T>) {
  const { formatMessage } = useI18n();
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize)) : 1;
  const resolvedEmptyTitle = emptyTitle ?? formatMessage("inventory.table.empty_title");
  const resolvedEmptyDescription = emptyDescription ?? formatMessage("inventory.table.empty_description");

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className={cn(maxHeight ? "overflow-auto" : undefined)} style={{ maxHeight }}>
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.className,
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right"
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={`${column.key}-${index}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40">
                  <InventoryEmptyState title={resolvedEmptyTitle} description={resolvedEmptyDescription} action={emptyAction} />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              data.map((item, index) => {
                const key = rowKey ? rowKey(item, index) : index;
                return (
                  <TableRow
                    key={key}
                    className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.cellClassName,
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right"
                        )}
                      >
                        {column.render(item, index)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
      {pagination && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>{formatMessage("inventory.table.page_label", { page: pagination.page, total: totalPages })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {formatMessage("inventory.table.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              {formatMessage("inventory.table.next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

