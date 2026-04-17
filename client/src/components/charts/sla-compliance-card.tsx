import React from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, Info } from 'lucide-react';

interface SlaComplianceCardProps {
  complianceRate: number;
  totalResolved: number;
  withinSla: number;
  hasSlaConfig: boolean;
  isLoading: boolean;
}

function getComplianceColor(rate: number): { bg: string; text: string; indicator: string; ring: string } {
  if (rate >= 90) return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', indicator: 'bg-emerald-500', ring: 'ring-emerald-500/20' };
  if (rate >= 70) return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', indicator: 'bg-amber-500', ring: 'ring-amber-500/20' };
  return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', indicator: 'bg-red-500', ring: 'ring-red-500/20' };
}

function SlaComplianceSkeleton() {
  return (
    <div className="w-full space-y-4 p-1">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function SlaNotConfigured({ message }: { message: string }) {
  return (
    <div className="w-full flex items-center gap-3 p-1">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Info className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export const SlaComplianceCard: React.FC<SlaComplianceCardProps> = ({
  complianceRate,
  totalResolved,
  withinSla,
  hasSlaConfig,
  isLoading,
}) => {
  const { formatMessage } = useI18n();

  if (isLoading) return <SlaComplianceSkeleton />;

  if (!hasSlaConfig) {
    return <SlaNotConfigured message={formatMessage('dashboard.sla_compliance.not_configured')} />;
  }

  const colors = getComplianceColor(complianceRate);
  const rate = Math.min(100, Math.max(0, complianceRate));
  const Icon = rate >= 70 ? ShieldCheck : AlertTriangle;

  return (
    <div className="w-full space-y-4 p-1">
      {/* Rate display */}
      <div className="flex items-center gap-4">
        <div className={cn('w-14 h-14 rounded-full flex items-center justify-center ring-2', colors.bg, colors.ring)}>
          <Icon className={cn('h-6 w-6', colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('text-3xl font-bold tabular-nums', colors.text)}>
            {rate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage('dashboard.sla_compliance.compliance_label')}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', colors.indicator)}
            style={{ width: `${rate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {formatMessage('dashboard.sla_compliance.within_sla', { count: String(withinSla) })}
          </span>
          <span>
            {formatMessage('dashboard.sla_compliance.total_resolved', { count: String(totalResolved) })}
          </span>
        </div>
      </div>
    </div>
  );
};
