import React from 'react';
import { useI18n } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import type { AggregationType } from '@shared/types/dashboard';

interface AggregationSelectorProps {
  value: AggregationType;
  onChange: (value: AggregationType) => void;
  isCustomer: boolean;
}

const ALL_OPTIONS: AggregationType[] = [
  'status',
  'priority',
  'department',
  'official',
  'incident_type',
  'category',
];

const CUSTOMER_OPTIONS: AggregationType[] = ['status', 'priority'];

const OPTION_I18N_KEYS: Record<AggregationType, string> = {
  status: 'dashboard.aggregation.by_status',
  priority: 'dashboard.aggregation.by_priority',
  department: 'dashboard.aggregation.by_department',
  official: 'dashboard.aggregation.by_official',
  incident_type: 'dashboard.aggregation.by_incident_type',
  category: 'dashboard.aggregation.by_category',
};

export const AggregationSelector: React.FC<AggregationSelectorProps> = ({
  value,
  onChange,
  isCustomer,
}) => {
  const { formatMessage } = useI18n();
  const options = isCustomer ? CUSTOMER_OPTIONS : ALL_OPTIONS;

  return (
    <div className="flex items-center gap-2">
      <BarChart3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Select value={value} onValueChange={(v) => onChange(v as AggregationType)}>
        <SelectTrigger className="w-48 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatMessage(OPTION_I18N_KEYS[option])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
