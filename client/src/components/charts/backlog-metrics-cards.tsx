import React from 'react';
import { useI18n } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Clock, UserX, PauseCircle } from 'lucide-react';

interface BacklogMetricsCardsProps {
  openOver7Days: number;
  unassigned: number;
  staleOver3Days: number;
  isLoading: boolean;
  onCardClick: (backlogType: string) => void;
}

function BacklogSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function BacklogEmpty({ message }: { message: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="col-span-full flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}

interface BacklogCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
  onClick: () => void;
}

function BacklogCard({ icon, label, value, colorClass, onClick }: BacklogCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border bg-card p-4 text-left transition-all w-full',
        'hover:shadow-md hover:border-primary/30 hover:scale-[1.02]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'cursor-pointer'
      )}
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
          {icon}
        </div>
        <span className="text-sm text-muted-foreground font-medium leading-tight">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </button>
  );
}

export const BacklogMetricsCards: React.FC<BacklogMetricsCardsProps> = ({
  openOver7Days,
  unassigned,
  staleOver3Days,
  isLoading,
  onCardClick,
}) => {
  const { formatMessage } = useI18n();

  if (isLoading) return <BacklogSkeleton />;

  const hasData = openOver7Days > 0 || unassigned > 0 || staleOver3Days > 0;
  if (!hasData) {
    return <BacklogEmpty message={formatMessage('dashboard.backlog.no_data')} />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <BacklogCard
        icon={<Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        label={formatMessage('dashboard.backlog.open_over_7_days')}
        value={openOver7Days}
        colorClass="bg-amber-500/10"
        onClick={() => onCardClick('open_over_7_days')}
      />
      <BacklogCard
        icon={<UserX className="h-5 w-5 text-red-600 dark:text-red-400" />}
        label={formatMessage('dashboard.backlog.unassigned')}
        value={unassigned}
        colorClass="bg-red-500/10"
        onClick={() => onCardClick('unassigned')}
      />
      <BacklogCard
        icon={<PauseCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
        label={formatMessage('dashboard.backlog.stale_over_3_days')}
        value={staleOver3Days}
        colorClass="bg-orange-500/10"
        onClick={() => onCardClick('stale_over_3_days')}
      />
    </div>
  );
};
