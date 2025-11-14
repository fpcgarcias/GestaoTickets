import { useMemo, useState } from "react";
import { format } from "date-fns";
import { InventoryLayout } from "@/components/inventory/inventory-layout";
import { useI18n } from "@/i18n";
import { InventoryFilterBar, InventoryFilterConfig, InventoryFilterValue } from "@/components/inventory/inventory-filter-bar";
import { EntityTable, EntityColumn } from "@/components/inventory/entity-table";
import {
  useInventoryAssignments,
  useCreateInventoryTerm,
  useReturnInventoryAssignment,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { useToast } from "@/hooks/use-toast";

const STATUS_OPTIONS = ["pending", "active", "completed"];
const ALL_VALUE = "__all__";

export default function InventoryAssignmentsPage() {
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    search: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const assignmentsQuery = useInventoryAssignments({
    search: filters.search || undefined,
    status: filters.status || undefined,
    page,
    limit: pageSize,
  });

  const generateTerm = useCreateInventoryTerm();
  const returnAssignment = useReturnInventoryAssignment();

  const assignments = assignmentsQuery.data?.data ?? [];
  const paginationInfo = assignmentsQuery.data?.pagination;
  const totalItems = paginationInfo?.total ?? assignments.length;

  const filterConfigs: InventoryFilterConfig[] = [
    {
      type: "search",
      key: "search",
      value: filters.search,
      placeholder: formatMessage("inventory.assignments.filters.search"),
      width: 240,
    },
    {
      type: "select",
      key: "status",
      value: filters.status || ALL_VALUE,
      placeholder: formatMessage("inventory.assignments.filters.status"),
      options: [
        { value: ALL_VALUE, label: formatMessage("inventory.assignments.filters.all_status") },
        ...STATUS_OPTIONS.map((status) => ({
          value: status,
          label: formatMessage(`inventory.assignments.status.${status}` as any),
        })),
      ],
      width: 200,
    },
  ];

  const handleFilterChange = (key: string, value: InventoryFilterValue) => {
    const normalizedValue = value === ALL_VALUE ? "" : value;
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: String(normalizedValue ?? "") }));
  };

  const resetFilters = () => {
    setFilters({ search: "", status: "" });
    setPage(1);
  };

  const handleGenerateTerm = (assignmentId: number) => {
    generateTerm.mutate({ assignmentId }, { onSuccess: () => toast({ title: formatMessage("inventory.assignments.table.term_created") }) });
  };

  const handleReturn = (assignmentId: number) => {
    returnAssignment.mutate({ assignmentId }, { onSuccess: () => toast({ title: formatMessage("inventory.assignments.table.return_registered") }) });
  };

  const formatDateValue = (value?: string | null) => {
    if (!value) return "--";
    const date = new Date(value);
    return format(date, locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy");
  };

  const columns: EntityColumn<any>[] = useMemo(
    () => [
      {
        key: "id",
        header: formatMessage("inventory.assignments.table.id"),
        render: (assignment) => `#${assignment.id}`,
      },
      {
        key: "product",
        header: formatMessage("inventory.assignments.table.product"),
        render: (assignment) => (
          <div className="flex flex-col">
            <span className="font-medium">#{assignment.product_id}</span>
            {assignment.product?.name && (
              <span className="text-xs text-muted-foreground">{assignment.product.name}</span>
            )}
          </div>
        ),
      },
      {
        key: "user",
        header: formatMessage("inventory.assignments.table.user"),
        render: (assignment) => assignment.user_name ?? `#${assignment.user_id}`,
      },
      {
        key: "dates",
        header: formatMessage("inventory.assignments.table.dates"),
        render: (assignment) => (
          <div className="text-xs">
            <div>
              {formatMessage("inventory.assignments.table.expected")} {formatDateValue(assignment.expected_return_date)}
            </div>
            <div>
              {formatMessage("inventory.assignments.table.actual")} {formatDateValue(assignment.actual_return_date)}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: formatMessage("inventory.assignments.table.status"),
        render: (assignment) => <InventoryStatusBadge status={assignment.status} />,
      },
      {
        key: "term",
        header: formatMessage("inventory.assignments.table.term_status"),
        render: (assignment) => (
          <span className="text-sm">
            {assignment.term_status
              ? formatMessage(`inventory.assignments.term_status.${assignment.term_status}` as any)
              : formatMessage("inventory.assignments.term_status.none")}
          </span>
        ),
      },
      {
        key: "actions",
        header: formatMessage("inventory.assignments.table.actions"),
        render: (assignment) => (
          <div className="flex flex-wrap gap-2">
            {!assignment.actual_return_date && (
              <Button variant="outline" size="sm" onClick={() => handleReturn(assignment.id)}>
                {formatMessage("inventory.assignments.table.return")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleGenerateTerm(assignment.id)}>
              {formatMessage("inventory.assignments.table.generate_term")}
            </Button>
          </div>
        ),
      },
    ],
    [formatDateValue, formatMessage]
  );

  return (
    <InventoryLayout
      title={formatMessage("inventory.assignments_title")}
      description={formatMessage("inventory.assignments_description")}
      breadcrumb={[{ label: formatMessage("inventory.assignments_breadcrumb") }]}
    >
      <div className="space-y-4">
        <InventoryFilterBar
          filters={filterConfigs}
          onChange={handleFilterChange}
          onReset={resetFilters}
          isDirty={Boolean(filters.search || filters.status)}
        />
        <EntityTable
          data={assignments}
          columns={columns}
          isLoading={assignmentsQuery.isLoading}
          pagination={{
            page: paginationInfo?.page ?? page,
            pageSize,
            totalItems,
            onPageChange: setPage,
          }}
          emptyTitle={formatMessage("inventory.assignments.table.empty_title")}
          emptyDescription={formatMessage("inventory.assignments.table.empty_description")}
        />
      </div>
    </InventoryLayout>
  );
}
