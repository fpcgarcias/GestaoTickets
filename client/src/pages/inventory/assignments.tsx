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
  useRequestDigitalSignature,
} from "@/hooks/useInventoryApi";
import { Button } from "@/components/ui/button";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_OPTIONS = ["pending", "active", "completed"];
const ALL_VALUE = "__all__";

// Função auxiliar para converter base64 em Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export default function InventoryAssignmentsPage() {
  const { formatMessage, locale } = useI18n();
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    search: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedAssignments, setSelectedAssignments] = useState<number[]>([]);
  const [sendToClicksign, setSendToClicksign] = useState(false);

  const assignmentsQuery = useInventoryAssignments({
    search: filters.search || undefined,
    status: filters.status || undefined,
    page,
    limit: pageSize,
  });

  const generateTerm = useCreateInventoryTerm();
  const returnAssignment = useReturnInventoryAssignment();
  const requestSignature = useRequestDigitalSignature();

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
    generateTerm.mutate({ assignmentId }, { 
      onSuccess: (data: any) => {
        toast({ title: formatMessage("inventory.assignments.table.term_created") });
        
        // Recarregar assignments para mostrar status atualizado
        assignmentsQuery.refetch();
        
        // Abrir PDF em nova aba
        if (data?.data?.pdfBase64) {
          const blob = base64ToBlob(data.data.pdfBase64, 'application/pdf');
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else if (data?.data?.downloadUrl) {
          window.open(data.data.downloadUrl, '_blank');
        }

        // Se checkbox marcado, enviar automaticamente para ClickSign
        if (sendToClicksign && data?.data?.id) {
          requestSignature.mutate({ termId: data.data.id }, {
            onSuccess: () => {
              // Recarregar novamente após enviar
              assignmentsQuery.refetch();
            }
          });
        }
      }
    });
  };

  const handleGenerateBatchTerm = () => {
    if (selectedAssignments.length === 0) {
      toast({ title: "Selecione pelo menos uma alocação", variant: "destructive" });
      return;
    }
    
    // Agrupar por assignment_group_id
    const grouped = assignments
      .filter(a => selectedAssignments.includes(a.id))
      .reduce((acc, assignment) => {
        const groupId = assignment.assignment_group_id || `single-${assignment.id}`;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(assignment);
        return acc;
      }, {} as Record<string, typeof assignments>);

    // Se todos estão no mesmo grupo, gerar termo em lote
    const groupKeys = Object.keys(grouped);
    if (groupKeys.length === 1 && grouped[groupKeys[0]].length > 1) {
      const groupId = groupKeys[0].startsWith('single-') ? undefined : groupKeys[0];
      const assignmentIds = grouped[groupKeys[0]].map(a => a.id);
      
      generateTerm.mutate(
        { assignmentGroupId: groupId, assignmentIds: groupId ? undefined : assignmentIds },
        { 
          onSuccess: (data: any) => {
            toast({ title: "Termo em lote gerado com sucesso!" });
            setSelectedAssignments([]);
            
            // Recarregar assignments para mostrar status atualizado
            assignmentsQuery.refetch();
            
            // Abrir PDF em nova aba
            if (data?.data?.pdfBase64) {
              const blob = base64ToBlob(data.data.pdfBase64, 'application/pdf');
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            } else if (data?.data?.downloadUrl) {
              window.open(data.data.downloadUrl, '_blank');
            }

            // Se checkbox marcado, enviar automaticamente para ClickSign
            if (sendToClicksign && data?.data?.id) {
              requestSignature.mutate({ termId: data.data.id }, {
                onSuccess: () => {
                  // Recarregar novamente após enviar
                  assignmentsQuery.refetch();
                }
              });
            }
          },
          onError: (error: any) => {
            toast({ title: "Erro ao gerar termo", description: error?.message, variant: "destructive" });
          }
        }
      );
    } else {
      // Múltiplos grupos ou seleção mista - gerar termo para todos selecionados
      const allIds = selectedAssignments;
      generateTerm.mutate(
        { assignmentIds: allIds },
        { 
          onSuccess: (data: any) => {
            toast({ title: "Termo em lote gerado com sucesso!" });
            setSelectedAssignments([]);
            
            // Recarregar assignments para mostrar status atualizado
            assignmentsQuery.refetch();
            
            // Abrir PDF em nova aba
            if (data?.data?.pdfBase64) {
              const blob = base64ToBlob(data.data.pdfBase64, 'application/pdf');
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            } else if (data?.data?.downloadUrl) {
              window.open(data.data.downloadUrl, '_blank');
            }

            // Se checkbox marcado, enviar automaticamente para ClickSign
            if (sendToClicksign && data?.data?.id) {
              requestSignature.mutate({ termId: data.data.id }, {
                onSuccess: () => {
                  // Recarregar novamente após enviar
                  assignmentsQuery.refetch();
                }
              });
            }
          },
          onError: (error: any) => {
            toast({ title: "Erro ao gerar termo", description: error?.message, variant: "destructive" });
          }
        }
      );
    }
  };

  const handleReturn = (assignmentId: number) => {
    returnAssignment.mutate({ assignmentId }, { onSuccess: () => toast({ title: formatMessage("inventory.assignments.table.return_registered") }) });
  };

  const handleSendToClicksign = (termId: number) => {
    requestSignature.mutate({ termId }, {
      onSuccess: () => {
        toast({ title: "Termo enviado para assinatura!" });
        // Recarregar assignments para mostrar status atualizado
        assignmentsQuery.refetch();
      },
      onError: (error: any) => {
        toast({ 
          title: "Erro ao enviar termo", 
          description: error?.message || "Erro desconhecido", 
          variant: "destructive" 
        });
      }
    });
  };

  const formatDateValue = (value?: string | null) => {
    if (!value) return "--";
    // Pegar apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
    const dateOnly = value.slice(0, 10);
    const [year, month, day] = dateOnly.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month é 0-indexed
    return format(date, locale === "en-US" ? "MM/dd/yyyy" : "dd/MM/yyyy");
  };

  const columns: EntityColumn<any>[] = useMemo(
    () => [
      {
        key: "select",
        header: "",
        render: (assignment) => (
          <Checkbox
            checked={selectedAssignments.includes(assignment.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedAssignments([...selectedAssignments, assignment.id]);
              } else {
                setSelectedAssignments(selectedAssignments.filter(id => id !== assignment.id));
              }
            }}
          />
        ),
      },
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
          <div className="flex items-center gap-2">
            <span className="text-sm whitespace-nowrap">
              {assignment.term_status
                ? formatMessage(`inventory.assignments.term_status.${assignment.term_status}` as any)
                : formatMessage("inventory.assignments.term_status.none")}
            </span>
            {assignment.responsibility_term_id && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                onClick={() => window.open(`/api/inventory/terms/${assignment.responsibility_term_id}/download`, '_blank')}
              >
                Ver PDF
              </Button>
            )}
          </div>
        ),
      },
      {
        key: "signature",
        header: formatMessage("inventory.assignments.table.signature_status"),
        render: (assignment) => {
          // DEBUG temporário - REMOVER DEPOIS
          console.log(`[DEBUG] Assignment #${assignment.id}:`, 
            `term_id=${assignment.responsibility_term_id}`, 
            `term_status="${assignment.term_status}"`,
            `signature_status="${assignment.signature_status}"`,
            `_debug:`, assignment._debug
          );

          // Só mostra "Não enviado" e botão se:
          // 1. Tem termo gerado (responsibility_term_id)
          // 2. NÃO foi enviado para ClickSign ainda (term_status === 'generated')
          const isGenerated = assignment.responsibility_term_id && assignment.term_status === 'generated';
          const isSent = assignment.term_status === 'sent';
          const isSigned = assignment.term_status === 'signed';
          
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-nowrap">
                {isSigned 
                  ? formatMessage("inventory.assignments.signature_status.signed")
                  : isSent
                    ? formatMessage("inventory.assignments.signature_status.pending")
                    : isGenerated
                      ? formatMessage("inventory.assignments.signature_status.not_sent")
                      : "--"}
              </span>
              {isGenerated && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-green-600 hover:text-green-800 hover:bg-green-50"
                  onClick={() => handleSendToClicksign(assignment.responsibility_term_id)}
                  disabled={requestSignature.isPending}
                >
                  {formatMessage("inventory.assignments.table.send_clicksign")}
                </Button>
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: formatMessage("inventory.assignments.table.actions"),
        render: (assignment) => (
          <div className="flex items-center gap-2">
            {!assignment.actual_return_date && (
              <Button 
                variant="outline" 
                size="sm"
                className="whitespace-nowrap"
                onClick={() => handleReturn(assignment.id)}
              >
                {formatMessage("inventory.assignments.table.return")}
              </Button>
            )}
            <Button 
              variant="default" 
              size="sm"
              className="whitespace-nowrap"
              onClick={() => handleGenerateTerm(assignment.id)}
            >
              {formatMessage("inventory.assignments.table.generate_term")}
            </Button>
          </div>
        ),
      },
    ],
    [formatDateValue, formatMessage, requestSignature.isPending, sendToClicksign]
  );

  return (
    <InventoryLayout
      title={formatMessage("inventory.assignments_title")}
      description={formatMessage("inventory.assignments_description")}
      breadcrumb={[{ label: formatMessage("inventory.assignments_breadcrumb") }]}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <InventoryFilterBar
            filters={filterConfigs}
            onChange={handleFilterChange}
            onReset={resetFilters}
            isDirty={Boolean(filters.search || filters.status)}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send-clicksign" 
                checked={sendToClicksign}
                onCheckedChange={(checked) => setSendToClicksign(!!checked)}
              />
              <label 
                htmlFor="send-clicksign"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {formatMessage("inventory.assignments.table.send_to_clicksign_auto")}
              </label>
            </div>
            {selectedAssignments.length > 0 && (
              <Button onClick={handleGenerateBatchTerm} variant="default">
                Gerar termo em lote ({selectedAssignments.length})
              </Button>
            )}
          </div>
        </div>
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
