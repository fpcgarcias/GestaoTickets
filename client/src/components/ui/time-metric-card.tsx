import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ComparisonArrow } from './comparison-arrow';

interface TimeMetricCardProps {
  title: string;
  description: string;
  value: number;
  previousValue?: number; // Valor anterior para comparação
  isLoading: boolean;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}

export const TimeMetricCard: React.FC<TimeMetricCardProps> = ({ 
  title, 
  description, 
  value, 
  previousValue,
  isLoading, 
  unit = 'horas',
  icon = <Clock className="h-4 w-4" />,
  trend,
  trendValue
}) => {
  const formatTime = (hours: number): string => {
    if (hours === 0) return '0h';
    
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}min`;
    }
    
    if (hours < 24) {
      const wholeHours = Math.floor(hours);
      const minutes = Math.round((hours - wholeHours) * 60);
      if (minutes === 0) {
        return `${wholeHours}h`;
      }
      return `${wholeHours}h ${minutes}min`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return `${days}d`;
    }
    return `${days}d ${remainingHours}h`;
  };

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral'): string => {
    switch (trend) {
      case 'up': return 'text-red-500';
      case 'down': return 'text-green-500';
      case 'neutral': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral'): React.ReactNode => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-3 w-3 rotate-0" />;
      case 'down': return <TrendingUp className="h-3 w-3 rotate-180" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold">
                {formatTime(value)}
              </div>
              {previousValue !== undefined && (
                <ComparisonArrow 
                  currentValue={value} 
                  previousValue={previousValue}
                  format="time"
                />
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
          {/* Manter compatibilidade com o sistema antigo de trends */}
          {trend && trendValue && previousValue === undefined && (
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(trend)}`}>
              {getTrendIcon(trend)}
              <span>{Math.abs(trendValue)}% em relação ao mês anterior</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 