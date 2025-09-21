import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './tooltip';

interface ComparisonArrowProps {
  currentValue: number;
  previousValue: number;
  format?: 'number' | 'time'; // 'time' para valores em minutos/horas
  className?: string;
}

export const ComparisonArrow: React.FC<ComparisonArrowProps> = ({ 
  currentValue, 
  previousValue, 
  format = 'number',
  className = '' 
}) => {
  // Se não há valor anterior, não mostrar comparação
  if (previousValue === null || previousValue === undefined) {
    return null;
  }

  // Calcular diferença percentual
  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const percentageChange = calculatePercentageChange(currentValue, previousValue);
  const isPositive = percentageChange > 0;
  const isNeutral = Math.abs(percentageChange) < 0.1; // Menos de 0.1% consideramos neutro

  // Para métricas de tempo, crescimento é ruim (vermelho), redução é boa (verde)
  // Para quantidade de tickets, crescimento pode ser neutro/informativo
  const getColorClass = () => {
    if (isNeutral) return 'text-gray-500';
    
    if (format === 'time') {
      // Para tempo: menos tempo = melhor (verde), mais tempo = pior (vermelho)
      return isPositive ? 'text-red-500' : 'text-green-500';
    } else {
      // Para números gerais: apenas informativo (azul para crescimento, laranja para redução)
      return isPositive ? 'text-blue-500' : 'text-orange-500';
    }
  };

  const getIcon = () => {
    if (isNeutral) return <Minus className="h-3 w-3" />;
    return isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  const formatPercentage = (value: number): string => {
    return `${Math.abs(value).toFixed(1)}%`;
  };

  // Gerar mensagem do tooltip
  const getTooltipMessage = (): string => {
    const percentage = formatPercentage(percentageChange);
    
    if (isNeutral) {
      return 'Valor praticamente inalterado em relação ao período anterior (variação < 0,1%)';
    }
    
    if (format === 'time') {
      if (isPositive) {
        return `⚠️ Tempo aumentou ${percentage} em relação ao período anterior\n(Performance piorou)`;
      } else {
        return `✅ Tempo diminuiu ${percentage} em relação ao período anterior\n(Performance melhorou)`;
      }
    } else {
      if (isPositive) {
        return `📈 Valor aumentou ${percentage} em relação ao período anterior\n(Crescimento de ${currentValue - previousValue} tickets)`;
      } else {
        return `📉 Valor diminuiu ${percentage} em relação ao período anterior\n(Redução de ${Math.abs(currentValue - previousValue)} tickets)`;
      }
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs cursor-help ${getColorClass()} ${className}`}>
            {getIcon()}
            <span>{formatPercentage(percentageChange)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center whitespace-pre-line">
            {getTooltipMessage()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
